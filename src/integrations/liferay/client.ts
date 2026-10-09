import { normalizeKey } from "@/domain/campaign/normalize";
import type { LiferayDocument, LiferayFolder } from "./types";

export type LiferayEnvironment = "production" | "staging-green" | "staging-blue";

export function liferayConfigFor(environment: LiferayEnvironment) {
  const siteId = environment === "production"
    ? (process.env.LIFERAY_SITE_ID_PRODUCTION ?? process.env.LIFERAY_SITE_ID ?? "20124")
    : (process.env.LIFERAY_SITE_ID_STAGING ?? process.env.LIFERAY_SITE_ID ?? "20124");

  let baseUrl: string | undefined;
  let variable: string;
  switch (environment) {
    case "production":
      baseUrl = process.env.LIFERAY_BASE_URL ?? "https://www.smiles.com.br";
      variable = "LIFERAY_BASE_URL";
      break;
    case "staging-green":
      baseUrl = process.env.LIFERAY_STAGING_GREEN_BASE_URL;
      variable = "LIFERAY_STAGING_GREEN_BASE_URL";
      break;
    case "staging-blue":
      baseUrl = process.env.LIFERAY_STAGING_BLUE_BASE_URL;
      variable = "LIFERAY_STAGING_BLUE_BASE_URL";
      break;
  }

  if (!baseUrl?.trim()) {
    throw new Error(`Configure ${variable} na Vercel (exemplo: https://www.smiles.com.br) e faça um novo deploy.`);
  }

  // Vercel values sometimes arrive copied with quotes or without a scheme.
  // Normalize these harmless variations, but never change the intended host.
  const trimmed = baseUrl.trim().replace(/^["']|["']$/g, "").trim();
  const candidate = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${variable} contém um endereço inválido. Configure apenas o domínio HTTPS, sem aspas nem caminho (ex.: https://www.smiles.com.br).`);
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/" ||
      !(parsed.hostname === "smiles.com.br" || parsed.hostname.endsWith(".smiles.com.br"))) {
    throw new Error(`${variable} deve conter somente uma origem HTTPS de smiles.com.br, sem caminho, parâmetros nem credenciais.`);
  }
  if (!/^\d+$/.test(String(siteId))) {
    throw new Error(`O site ID configurado para ${environment} é inválido: informe somente o ID numérico do site Liferay.`);
  }

  return {
    baseUrl: parsed.origin,
    siteId,
  };
}

const headers = {
  Accept: "application/json",
  "Accept-Language": "pt-BR",
};

export type DocumentDiscoveryDiagnostic = {
  endpoint: string;
  rawCount: number;
  mappedCount: number;
  detail: string;
};

export type DocumentListing = {
  documents: LiferayDocument[];
  diagnostics: DocumentDiscoveryDiagnostic[];
};

type Collection<T> = {
  items?: T[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
  lastPage?: number;
};

async function getJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers, cache: "no-store", redirect: "manual" });
  } catch (error) {
    throw new Error(`Falha de rede ao consultar o Liferay: ${error instanceof Error ? error.message : "conexão indisponível"}.`);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Liferay redirecionou a consulta HTTP ${response.status} (possível login/SSO).`);
  }
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let detail = "";
    if (contentType.includes("json")) {
      try {
        const body = await response.json() as { title?: string; detail?: string; message?: string; status?: string };
        detail = [body.title, body.detail, body.message].filter(Boolean).join(" — ").slice(0, 240);
      } catch {
        // No body diagnostics; preserve HTTP status.
      }
    }
    throw new Error(`Liferay respondeu HTTP ${response.status}${detail ? `: ${detail}` : ""}.`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (type && !type.includes("json")) {
    throw new Error(`Liferay retornou ${type.split(";")[0]} em vez de JSON (possível login/SSO ou endpoint incorreto).`);
  }
  try {
    return await response.json() as T;
  } catch {
    throw new Error("Liferay respondeu com conteúdo que não é JSON válido.");
  }
}

function absoluteContentUrl(contentUrl: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(contentUrl)) return contentUrl;
  return new URL(contentUrl, `${baseUrl}/`).toString();
}

function mapFolder(raw: any): LiferayFolder | null {
  const id = raw?.id ?? raw?.documentFolderId;
  const name = raw?.name ?? raw?.title;
  if (id === undefined || !name) return null;
  const reportedCount = raw?.numberOfDocuments;
  return {
    id,
    name: String(name),
    numberOfDocuments: typeof reportedCount === "number" && Number.isInteger(reportedCount) && reportedCount >= 0
      ? reportedCount : undefined,
  };
}

function mapDocument(raw: any, baseUrl: string): LiferayDocument | null {
  const id = raw?.id;
  const title = raw?.title ?? raw?.fileName ?? raw?.name;
  const contentUrl = raw?.contentUrl ?? raw?.contentURL;
  if (id === undefined || !title || !contentUrl) return null;
  return {
    id,
    title: String(title),
    contentUrl: absoluteContentUrl(String(contentUrl), baseUrl),
    fileExtension: raw?.fileExtension ? String(raw.fileExtension) : undefined,
  };
}

function escapeOData(value: string) {
  return value.replace(/'/g, "''");
}

export async function findFolderByName(name: string, environment: LiferayEnvironment = "production"): Promise<LiferayFolder | null> {
  const { baseUrl, siteId } = liferayConfigFor(environment);
  const target = normalizeKey(name);
  const exactExpression = `name eq '${escapeOData(name)}'`;
  const queries = [
    `flatten=true&pageSize=200&search=${encodeURIComponent(name)}`,
    `pageSize=200&search=${encodeURIComponent(name)}`,
    `flatten=true&pageSize=200&filter=${encodeURIComponent(exactExpression)}`,
  ];

  let lastError: unknown = null;
  let completedRequest = false;
  for (const query of queries) {
    try {
      const data = await getJson<Collection<any>>(`${baseUrl}/o/headless-delivery/v1.0/sites/${siteId}/document-folders?${query}`);
      completedRequest = true;
      const folders = (data.items ?? []).map(mapFolder).filter((item): item is LiferayFolder => Boolean(item));
      const exact = folders.find((folder) => normalizeKey(folder.name) === target);
      if (exact) return exact;
    } catch (error) {
      lastError = error;
    }
  }

  if (!completedRequest && lastError instanceof Error) throw lastError;
  return null;
}

async function readAllPages<T>(firstUrl: string, maxPages = 50): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const url = new URL(firstUrl);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", "200");
    const data = await getJson<Collection<T>>(url.toString());
    if (!Array.isArray(data?.items)) throw new Error("Liferay retornou uma coleção sem o campo items (array).");
    all.push(...data.items);
    lastPage = Math.max(1, data.lastPage ?? Math.ceil((data.totalCount ?? all.length) / (data.pageSize ?? 200)));
    page += 1;
  } while (page <= lastPage && page <= maxPages);

  return all;
}

/** Discover only documents proven to belong to the selected Liferay folder. */
export async function listFolderDocuments(
  folderId: number | string,
  environment: LiferayEnvironment = "production",
  searchTerms: string[] = [],
): Promise<DocumentListing> {
  const { baseUrl, siteId } = liferayConfigFor(environment);
  const diagnostics: DocumentDiscoveryDiagnostic[] = [];
  const folderUrl = `${baseUrl}/o/headless-delivery/v1.0/document-folders/${folderId}/documents`;

  // The folder-scoped endpoint is the preferred, authoritative way to list its media.
  try {
    const raw = await readAllPages<any>(folderUrl);
    const documents = raw.map((item) => mapDocument(item, baseUrl)).filter((item): item is LiferayDocument => Boolean(item));
    diagnostics.push({
      endpoint: "document-folders/{id}/documents",
      rawCount: raw.length,
      mappedCount: documents.length,
      detail: raw.length === 0
        ? "A consulta direta da pasta retornou uma lista vazia."
        : raw.length !== documents.length
          ? `${raw.length - documents.length} item(ns) sem ID, título ou contentUrl.`
          : "Documentos encontrados pelo endpoint da pasta.",
    });
    if (documents.length) return { documents, diagnostics };
  } catch (error) {
    diagnostics.push({
      endpoint: "document-folders/{id}/documents",
      rawCount: 0,
      mappedCount: 0,
      detail: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }

  // Avoid filtering by documentFolderId/folderId via OData here: some DXP versions
  // reject those expressions with HTTP 400. Instead search the site by title/airline,
  // and locally verify documentFolderId before accepting any candidate.
  const terms = Array.from(new Set(searchTerms.map((term) => term.trim()).filter(Boolean)));
  if (terms.length === 0) {
    diagnostics.push({
      endpoint: "sites/{id}/documents?search=",
      rawCount: 0,
      mappedCount: 0,
      detail: "Sem termos de busca; a pesquisa no site não foi executada.",
    });
    return { documents: [], diagnostics };
  }

  const matched = new Map<string, LiferayDocument>();
  // Bound outbound concurrency to avoid flooding the Liferay search service.
  for (let offset = 0; offset < terms.length; offset += 4) {
    const batch = terms.slice(offset, offset + 4);
    const batchResults = await Promise.all(batch.map(async (term) => {
      const url = `${baseUrl}/o/headless-delivery/v1.0/sites/${siteId}/documents?flatten=true&recursive=true&search=${encodeURIComponent(term)}`;
      try {
        // Search results are paginated; up to 3 pages per term (600 records).
        const raw = await readAllPages<any>(url, 3);
        const withFolderId = raw.filter((item) => item.documentFolderId !== null && item.documentFolderId !== undefined);
        const inFolder = withFolderId.filter((item) => String(item.documentFolderId) === String(folderId));
        const documents = inFolder.map((item) => mapDocument(item, baseUrl))
          .filter((item): item is LiferayDocument => Boolean(item));
        return {
          documents,
          diagnostic: {
            endpoint: `sites/{id}/documents?search=${encodeURIComponent(term)}`,
            rawCount: raw.length,
            mappedCount: documents.length,
            detail: raw.length === 0
              ? "Busca do site vazia para este termo."
              : `${withFolderId.length}/${raw.length} item(ns) possuem documentFolderId; ${inFolder.length} pertencem à pasta ${folderId}; ${documents.length} possuem ID, título e URL.`,
          } satisfies DocumentDiscoveryDiagnostic,
        };
      } catch (error) {
        return {
          documents: [] as LiferayDocument[],
          diagnostic: {
            endpoint: `sites/{id}/documents?search=${encodeURIComponent(term)}`,
            rawCount: 0,
            mappedCount: 0,
            detail: error instanceof Error ? error.message : "Erro desconhecido.",
          } satisfies DocumentDiscoveryDiagnostic,
        };
      }
    }));

    for (const result of batchResults) {
      diagnostics.push(result.diagnostic);
      for (const doc of result.documents) matched.set(String(doc.id), doc);
    }
  }

  return { documents: Array.from(matched.values()), diagnostics };
}

// Resolve configuration lazily. Public document URLs and Headless listing permissions are distinct.
