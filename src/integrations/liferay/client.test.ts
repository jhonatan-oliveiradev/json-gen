import { afterEach, describe, expect, it, vi } from "vitest";
import { liferayConfigFor } from "./client";

afterEach(() => vi.unstubAllEnvs());

describe("liferayConfigFor", () => {
  it("uses production by default", () => {
    vi.stubEnv("LIFERAY_BASE_URL", "https://www.smiles.com.br");
    vi.stubEnv("LIFERAY_SITE_ID_PRODUCTION", "100");
    const config = liferayConfigFor("production");
    expect(config).toEqual({ baseUrl: "https://www.smiles.com.br", siteId: "100" });
  });

  it("uses independent green/blue URLs and a shared staging site id", () => {
    vi.stubEnv("LIFERAY_STAGING_GREEN_BASE_URL", "https://portal-green-stg-svc.smiles.com.br");
    vi.stubEnv("LIFERAY_STAGING_BLUE_BASE_URL", "https://portal-blue-stg-svc.smiles.com.br");
    vi.stubEnv("LIFERAY_SITE_ID_STAGING", "200");

    expect(liferayConfigFor("staging-green")).toEqual({
      baseUrl: "https://portal-green-stg-svc.smiles.com.br",
      siteId: "200",
    });
    expect(liferayConfigFor("staging-blue")).toEqual({
      baseUrl: "https://portal-blue-stg-svc.smiles.com.br",
      siteId: "200",
    });
  });

  it("fails explicitly when selected staging URL is not configured", () => {
    vi.stubEnv("LIFERAY_STAGING_BLUE_BASE_URL", "");
    expect(() => liferayConfigFor("staging-blue")).toThrow("LIFERAY_STAGING_BLUE_BASE_URL");
  });

  it("refuses non-HTTPS or path-based origin settings", () => {
    vi.stubEnv("LIFERAY_STAGING_GREEN_BASE_URL", "http://portal-green-stg-svc.smiles.com.br");
    expect(() => liferayConfigFor("staging-green")).toThrow("HTTPS");
    vi.stubEnv("LIFERAY_STAGING_GREEN_BASE_URL", "https://portal-green-stg-svc.smiles.com.br/documents");
    expect(() => liferayConfigFor("staging-green")).toThrow("HTTPS");
  });
});
