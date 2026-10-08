export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeKey(value: unknown): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function nullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

export function parseDropdown(value: unknown) {
  const raw = cleanText(value);
  const normalized = normalizeKey(raw);

  if (!normalized || normalized === "SOLTA") {
    return { type: "single" as const };
  }

  const key = normalized.replace(/^DROPDOWN\s*/i, "").trim();
  return {
    type: "group" as const,
    key: key || normalized,
    raw,
  };
}

export function extractCampaignCode(sourceName?: string | null): string | null {
  if (!sourceName) return null;
  return sourceName.match(/AER\d+/i)?.[0]?.toUpperCase() ?? null;
}

export function extractCarouselNumber(carousel: string): number | null {
  const match = normalizeKey(carousel).match(/CARROSSEL\s*0*(\d+)/);
  return match ? Number(match[1]) : null;
}
