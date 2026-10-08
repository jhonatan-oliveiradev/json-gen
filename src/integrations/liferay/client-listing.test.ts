import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listFolderDocuments } from "./client";

function apiResult(items: unknown[]) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ items, page: 1, pageSize: 200, totalCount: items.length, lastPage: 1 }),
  } as Response;
}

function denied(status = 403) {
  return {
    ok: false,
    status,
    headers: new Headers(),
  } as Response;
}

beforeEach(() => {
  vi.stubEnv("LIFERAY_STAGING_GREEN_BASE_URL", "https://portal-green-stg-svc.smiles.com.br");
  vi.stubEnv("LIFERAY_SITE_ID_STAGING", "20124");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Liferay Headless document listing", () => {
  it("uses folder documents endpoint and returns a real contentUrl without guessing a suffix", async () => {
    const mock = vi.fn(async () => apiResult([
      { id: 98, title: "SCL_750x500_1", contentUrl: "/documents/d/guest/scl_750x500_1-68", documentFolderId: 77 },
    ]));
    vi.stubGlobal("fetch", mock);
    const result = await listFolderDocuments(77, "staging-green");

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].contentUrl).toBe("https://portal-green-stg-svc.smiles.com.br/documents/d/guest/scl_750x500_1-68");
    expect(result.diagnostics[0]).toMatchObject({ rawCount: 1, mappedCount: 1 });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("reports documents without contentUrl instead of incorrectly saying the folder is empty", async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return apiResult(url.includes("/document-folders/77/documents")
        ? [{ id: 98, title: "SCL_750x500_1", documentFolderId: 77 }]
        : []);
    });
    vi.stubGlobal("fetch", mock);
    const result = await listFolderDocuments(77, "staging-green");

    expect(result.documents).toHaveLength(0);
    expect(result.diagnostics[0]).toMatchObject({ rawCount: 1, mappedCount: 0 });
    expect(result.diagnostics[0].detail).toContain("contentUrl");
  });

  it("reports authentication failures from each endpoint rather than silently returning zero documents", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => denied(403)));
    const result = await listFolderDocuments(77, "staging-green");

    expect(result.documents).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(3);
    expect(result.diagnostics.every((item) => item.detail.includes("403"))).toBe(true);
  });

  it("identifies redirected authentication responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 302,
      headers: new Headers({ location: "/c/portal/login" }),
    } as Response)));
    const result = await listFolderDocuments(77, "staging-green");

    expect(result.documents).toHaveLength(0);
    expect(result.diagnostics[0].detail).toContain("SSO");
  });
});
