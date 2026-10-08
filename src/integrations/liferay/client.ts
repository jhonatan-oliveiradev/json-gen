import { normalizeKey } from "@/domain/campaign/normalize";
import type { LiferayDocument, LiferayFolder } from "./types";

const BASE_URL = (process.env.LIFERAY_BASE_URL ?? "https://portal-green-stg-svc.smiles.com.br").replace(/\/$/, "");
const SITE_ID = process.env.LIFERAY_SITE_ID ?? "20124";

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

function absoluteContentUrl(contentUrl: string): string {
  if (/^https?:\/\//i.test(contentUrl)) return contentUrl;
  return new URL(contentUrl, `${BASE_URL}/`).toString();
}

function mapFolder(raw: any): LiferayFolder | null {
  const id = raw?.id ?? raw?.documentFolderId;
  const name = raw?.name ?? raw?.title;
  if (id === undefined || !name) return null;
  return { id, name: String(name) };
}

function mapDocument(raw: any): LiferayDocument | null {
  const id = raw?.id;
  const title = raw?.title ?? raw?.fileName ?? raw?.name;
  const contentUrl = raw?.contentUrl ?? raw?.contentURL;
  if (id === undefined || !title || !contentUrl) return null;
  return {
    id,
    title: String(title),
    contentUrl: absoluteContentUrl(String(contentUrl)),
    fileExtension: raw?.fileExtension ? String(raw.fileExtension) : undefined,
  };
}

function escapeOData(value: string) {
  return value.replace(/'/g, "''");
}

export async function findFolderByName(name: string): Promise<LiferayFolder | null> {
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
      const data = await getJson<Collection<any>>(`${BASE_URL}/o/headless-delivery/v1.0/sites/${SITE_ID}/document-folders?${query}`);
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

export async function listFolderDocuments(folderId: number | string): Promise<LiferayDocument[]> {
  const attempts = [
    `${BASE_URL}/o/headless-delivery/v1.0/document-folders/${folderId}/documents`,
    `${BASE_URL}/o/headless-delivery/v1.0/sites/${SITE_ID}/documents?filter=${encodeURIComponent(`documentFolderId eq ${folderId}`)}`,
    `${BASE_URL}/o/headless-delivery/v1.0/sites/${SITE_ID}/documents?filter=${encodeURIComponent(`folderId eq ${folderId}`)}`,
  ];

  let lastError: unknown = null;
  let completedRequest = false;
  for (const url of attempts) {
    try {
      const raw = await readAllPages<any>(url);
      completedRequest = true;
      const documents = raw.map(mapDocument).filter((item): item is LiferayDocument => Boolean(item));
      if (documents.length) return documents;
    } catch (error) {
      lastError = error;
    }
  }

  if (!completedRequest && lastError instanceof Error) throw lastError;
  return [];
}

export const liferayConfig = { baseUrl: BASE_URL, siteId: SITE_ID };
