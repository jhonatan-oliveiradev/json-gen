/**
 * Manual URL import is a deterministic fallback when the Liferay Headless API
 * is unavailable to the local app (for example, when browser SSO is required).
 * Never guess asset suffixes or silently match a URL to a different carousel.
 */
export function parseDestinationUrls(input: string, expectedIatas: string[], environment: "production" | "staging-green" | "staging-blue" = "production"): {
  urls: Record<string, string>;
  errors: string[];
} {
  const urls: Record<string, string> = {};
  const errors: string[] = [];
  const expected = new Set(expectedIatas.map((iata) => iata.toUpperCase()));
  const tokens = input.match(/https?:\/\/[^\s<>,"']+/gi) ?? [];
  const nonempty = input.trim();

  if (nonempty && tokens.length === 0) {
    errors.push("Nenhuma URL encontrada. Cole os links completos dos documentos do Liferay.");
  }

  for (const token of tokens) {
    let parsed: URL;
    try {
      parsed = new URL(token);
    } catch {
      errors.push("URL inválida: " + token);
      continue;
    }

    if (parsed.protocol !== "https:" || (parsed.hostname !== "smiles.com.br" && !parsed.hostname.endsWith(".smiles.com.br"))) {
      errors.push("Use apenas URLs HTTPS do domínio Smiles: " + token);
      continue;
    }

    // Do not mix assets from production, green and blue in one export.
    const hostname = parsed.hostname.toLowerCase();
    const isStaging = /(?:^|[-.])(?:stg|staging)(?:[-.]|$)/.test(hostname);
    if (environment === "production" && isStaging) {
      errors.push("URL de staging não permitida em produção: " + token);
      continue;
    }
    if (environment === "staging-green" && (!isStaging || !hostname.includes("green") || hostname.includes("blue"))) {
      errors.push("A URL não pertence ao Staging Green: " + token);
      continue;
    }
    if (environment === "staging-blue" && (!isStaging || !hostname.includes("blue") || hostname.includes("green"))) {
      errors.push("A URL não pertence ao Staging Blue: " + token);
      continue;
    }

    if (!parsed.pathname.startsWith("/documents/")) {
      errors.push("A URL não aponta para um documento do Liferay: " + token);
      continue;
    }

    let title: string;
    try {
      title = decodeURIComponent(parsed.pathname.split("/").pop() ?? "");
    } catch {
      errors.push("Nome do documento contém caracteres inválidos: " + token);
      continue;
    }
    const match = title.match(/^([a-zA-Z]{3})(?:[_-]|$)/);
    const iata = match?.[1].toUpperCase();
    if (!iata || !expected.has(iata)) {
      errors.push("Destino não pertence a este carrossel (ou nome sem IATA): " + title);
      continue;
    }

    if (urls[iata] && urls[iata] !== parsed.toString()) {
      errors.push("Duas URLs diferentes para " + iata + "; mantenha apenas a imagem correta.");
      delete urls[iata];
      continue;
    }
    urls[iata] = parsed.toString();
  }

  return { urls, errors };
}
