import { describe, expect, it } from "vitest";
import { describeLiferayNetworkError } from "./network-errors";

describe("Liferay fetch network errors", () => {
  it("extracts DNS errors from fetch's nested cause", () => {
    const error = new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });
    expect(describeLiferayNetworkError(error)).toMatchObject({ type: "DNS", code: "ENOTFOUND" });
  });

  it("classifies TLS certificate rejection without suggesting insecure bypass", () => {
    const error = { cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } };
    expect(describeLiferayNetworkError(error)).toMatchObject({ type: "TLS" });
  });

  it("classifies Undici timeouts and connection refusal", () => {
    expect(describeLiferayNetworkError({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }).type).toBe("TIMEOUT");
    expect(describeLiferayNetworkError({ cause: { code: "ECONNREFUSED" } }).type).toBe("CONNECTION");
  });

  it("does not expose raw internal errors or URLs in the response", () => {
    const error = new Error("https://internal.example:443?token=secret");
    const diagnostic = describeLiferayNetworkError(error);
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
    expect(diagnostic.type).toBe("UNKNOWN");
  });
});
