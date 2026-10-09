/** Redacted, client-safe diagnostics for failed Node/Undici fetches. */
export type LiferayNetworkCode =
  | "DNS" | "TIMEOUT" | "TLS" | "CONNECTION" | "UNKNOWN";

export class LiferayNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiferayNetworkError";
  }
}

type ErrorLike = {
  code?: unknown;
  cause?: unknown;
  errors?: unknown[];
  name?: unknown;
};

const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "ENODATA", "EAI_FAIL"]);
const TIMEOUT_CODES = new Set(["UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "ETIMEDOUT", "ABORT_ERR"]);
const TLS_CODES = new Set([
  "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "ERR_TLS_CERT_ALTNAME_INVALID", "ERR_SSL_WRONG_VERSION_NUMBER",
]);
const CONNECTION_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH", "EPIPE",
  "UND_ERR_SOCKET", "UND_ERR_CONNECT",
]);

export function describeLiferayNetworkError(error: unknown): {
  type: LiferayNetworkCode;
  code: string;
  hint: string;
} {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  const codes: string[] = [];
  let abort = false;

  while (pending.length && seen.size < 12) {
    const candidate = pending.shift();
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) continue;
    seen.add(candidate);
    const entry = candidate as ErrorLike;
    if (typeof entry.code === "string" && /^[A-Z0-9_]{2,60}$/.test(entry.code)) {
      codes.push(entry.code);
    }
    if (entry.name === "TimeoutError" || entry.name === "AbortError") abort = true;
    if (entry.cause) pending.push(entry.cause);
    if (Array.isArray(entry.errors)) pending.push(...entry.errors.slice(0, 5));
  }

  const detected = codes.find((c) => DNS_CODES.has(c)) ??
    codes.find((c) => TLS_CODES.has(c)) ??
    codes.find((c) => TIMEOUT_CODES.has(c)) ??
    codes.find((c) => CONNECTION_CODES.has(c));
  const code = detected ?? (abort ? "TIMEOUT" : "UNCLASSIFIED");

  if (DNS_CODES.has(code)) return {
    type: "DNS", code,
    hint: "O servidor da Vercel não consegue resolver o DNS desse host. Confirme se ele é público ou exige DNS/VPN corporativo.",
  };
  if (TLS_CODES.has(code)) return {
    type: "TLS", code,
    hint: "A conexão falhou na validação TLS. Verifique a cadeia de certificados no servidor; não desative a verificação TLS.",
  };
  if (TIMEOUT_CODES.has(code) || abort) return {
    type: "TIMEOUT", code,
    hint: "A conexão expirou. Verifique firewall, roteamento e regras de entrada para requisições originadas na Vercel.",
  };
  if (CONNECTION_CODES.has(code)) return {
    type: "CONNECTION", code,
    hint: "O servidor remoto recusou ou interrompeu a conexão. Confira política de rede, firewall e allowlist.",
  };
  return {
    type: "UNKNOWN", code,
    hint: "A conexão falhou antes de uma resposta HTTP; consulte os logs de runtime da Vercel e a infraestrutura do Liferay.",
  };
}
