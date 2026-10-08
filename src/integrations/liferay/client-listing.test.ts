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
    const result = await listFolderDocuments(77, "staging-green", ["SCL"]);

    expect(result.documents).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics.every((item) => item.detail.includes("403"))).toBe(true);
  });

  it("finds an asset by a site search and accepts only its exact folder ID", async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/document-folders/77/documents")) return apiResult([]);
      if (url.includes("/sites/20124/documents") && url.includes("search=SCL")) {
        return apiResult([
          { id: 101, title: "SCL_750x500_1", documentFolderId: 77, contentUrl: "/documents/d/guest/scl_750x500_1-68" },
          { id: 102, title: "SCL_750x500_1", documentFolderId: 88, contentUrl: "/documents/d/guest/scl_750x500_1-other" },
          { id: 103, title: "SCL_750x500_1", contentUrl: "/documents/d/guest/scl_750x500_unknown" },
        ]);
      }
      return apiResult([]);
    });
    vi.stubGlobal("fetch", mock);
    const result = await listFolderDocuments(77, "staging-green", ["SCL"]);

    expect(result.documents.map((doc) => doc.id)).toEqual([101]);
    expect(result.documents[0].contentUrl).toContain("/documents/d/guest/scl_750x500_1-68");
    expect(result.diagnostics[1]).toMatchObject({ rawCount: 3, mappedCount: 1 });
    expect(mock.mock.calls.some((args) => String(args[0]).includes("filter="))).toBe(false);
    expect(mock.mock.calls.some((args) => String(args[0]).includes("flatten=true&recursive=true&search=SCL"))).toBe(true);
  });

  it("does not assume an asset belongs to the folder when metadata has no documentFolderId", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      apiResult(String(input).includes("search=SCL")
        ? [{ id: 201, title: "SCL_750x500_1", contentUrl: "/documents/d/guest/scl_750x500_1-68" }]
        : [])));
    const result = await listFolderDocuments(77, "staging-green", ["SCL"]);
    expect(result.documents).toHaveLength(0);
    expect(result.diagnostics[1]).toMatchObject({ rawCount: 1, mappedCount: 0 });
  });

  it("reveals useful HTTP 400 API response details instead of retrying unsupported filters", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("search=SCL")
        ? {
            ok: false,
            status: 400,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ title: "BAD_REQUEST", detail: "Search index is unavailable" }),
          } as Response
        : apiResult([])));
    const result = await listFolderDocuments(77, "staging-green", ["SCL"]);
    expect(result.diagnostics[1].detail).toContain("HTTP 400");
    expect(result.diagnostics[1].detail).toContain("Search index is unavailable");
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
