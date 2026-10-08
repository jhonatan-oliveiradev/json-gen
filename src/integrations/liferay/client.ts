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

type Collection<T> = {
  items?: T[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
  lastPage?: number;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Liferay respondeu ${response.status} ao consultar ${new URL(url).pathname}.`);
  }
  return response.json() as Promise<T>;
}

function absoluteContentUrl(contentUrl: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(contentUrl)) return contentUrl;
  return new URL(contentUrl, `${baseUrl}/`).toString();
}

function mapFolder(raw: any): LiferayFolder | null {
  const id = raw?.id ?? raw?.documentFolderId;
  const name = raw?.name ?? raw?.title;
  if (id === undefined || !name) return null;
  return { id, name: String(name) };
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

async function readAllPages<T>(firstUrl: string): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const url = new URL(firstUrl);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", "200");
    const data = await getJson<Collection<T>>(url.toString());
    all.push(...(data.items ?? []));
    lastPage = Math.max(1, data.lastPage ?? Math.ceil((data.totalCount ?? all.length) / (data.pageSize ?? 200)));
    page += 1;
  } while (page <= lastPage && page <= 50);

  return all;
}

export async function listFolderDocuments(folderId: number | string, environment: LiferayEnvironment = "production"): Promise<LiferayDocument[]> {
  const { baseUrl, siteId } = liferayConfigFor(environment);
  const attempts = [
    `${baseUrl}/o/headless-delivery/v1.0/document-folders/${folderId}/documents`,
    `${baseUrl}/o/headless-delivery/v1.0/sites/${siteId}/documents?filter=${encodeURIComponent(`documentFolderId eq ${folderId}`)}`,
    `${baseUrl}/o/headless-delivery/v1.0/sites/${siteId}/documents?filter=${encodeURIComponent(`folderId eq ${folderId}`)}`,
  ];

  let lastError: unknown = null;
  let completedRequest = false;
  for (const url of attempts) {
    try {
      const raw = await readAllPages<any>(url);
      completedRequest = true;
      const documents = raw.map((item) => mapDocument(item, baseUrl)).filter((item): item is LiferayDocument => Boolean(item));
      if (documents.length) return documents;
    } catch (error) {
      lastError = error;
    }
  }

  if (!completedRequest && lastError instanceof Error) throw lastError;
  return [];
}

// Environment configuration is resolved per request, so unused staging URLs are not required for production.
