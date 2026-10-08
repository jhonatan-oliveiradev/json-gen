import { normalizeKey } from "@/domain/campaign/normalize";
import type { AssetResolution, LiferayDocument } from "./types";

const AIRLINE_ALIASES: Record<string, string> = {
  "AMERICAN AIRLINES": "AMERICAN",
  AMERICAN: "AMERICAN",
  AA: "AMERICAN",
  "TAP AIR PORTUGAL": "TAP PORTUGAL",
  TAP: "TAP PORTUGAL",
  TP: "TAP PORTUGAL",
  "TAP PORTUGAL": "TAP PORTUGAL",
  GOL: "GOL",
  G3: "GOL",
  "GOL LINHAS AEREAS": "GOL",
  SKY: "SKY",
  H2: "SKY",
  "SKY AIRLINE": "SKY",
  "AIR EUROPA": "AIR EUROPA",
  UX: "AIR EUROPA",
};

function titleWithoutExtension(title: string) {
  return title.replace(/\.[a-z0-9]{2,5}$/i, "");
}

function resolved(document: LiferayDocument): AssetResolution {
  return {
    status: "resolved",
    url: document.contentUrl,
    documentId: document.id,
    title: document.title,
  };
}

function finalize(matches: LiferayDocument[]): AssetResolution {
  if (matches.length === 0) return { status: "missing", candidates: [] };
  if (matches.length === 1) return resolved(matches[0]);
  return {
    status: "ambiguous",
    candidates: matches.map((document) => ({ id: document.id, title: document.title, url: document.contentUrl })),
  };
}

export function resolveDestinationAsset(iata: string, documents: LiferayDocument[]): AssetResolution {
  const key = normalizeKey(iata);
  const matches = documents.filter((document) => {
    const title = normalizeKey(titleWithoutExtension(document.title));
    return title === key || title.startsWith(`${key}_`) || title.startsWith(`${key}-`);
  });
  return finalize(matches);
}

function normalizeAirlineToken(value: string): string {
  return normalizeKey(value).replace(/[^A-Z0-9]+/g, " ").trim();
}

export function canonicalAirlineName(airline: string): string {
  const normalized = normalizeAirlineToken(airline);
  return AIRLINE_ALIASES[normalized] ?? normalized;
}

export function resolveAirlineAsset(airline: string, documents: LiferayDocument[]): AssetResolution {
  const key = canonicalAirlineName(airline);
  const exact = documents.filter((document) => canonicalAirlineName(titleWithoutExtension(document.title)) === key);
  if (exact.length) return finalize(exact);

  const prefix = documents.filter((document) => {
    const title = normalizeAirlineToken(titleWithoutExtension(document.title));
    return title === key || title.startsWith(`${key} `);
  });
  return finalize(prefix);
}
