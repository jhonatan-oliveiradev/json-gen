import { describe, expect, it } from "vitest";
import { parseDestinationUrls } from "./manual-assets";

describe("parseDestinationUrls", () => {
  it("maps multiple staging document URLs using IATA from the filename", () => {
    const text = [
      "https://portal-green-stg-svc.smiles.com.br/documents/d/guest/scl_750x500_1-68",
      "https://portal-green-stg-svc.smiles.com.br/documents/d/guest/lim_750x500_01-4",
    ].join("\n");
    const result = parseDestinationUrls(text, ["SCL", "LIM"], "staging");
    expect(result.errors).toEqual([]);
    expect(Object.keys(result.urls)).toEqual(["SCL", "LIM"]);
    expect(result.urls.SCL).toContain("scl_750x500_1-68");
  });

  it("does not use a destination not present in the active carousel", () => {
    const result = parseDestinationUrls("https://www.smiles.com.br/documents/d/guest/mia_750x500_1", ["SCL"]);
    expect(result.urls).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("blocks staging URLs from entering a production export", () => {
    const url = "https://portal-green-stg-svc.smiles.com.br/documents/d/guest/scl_750x500_1-68";
    const result = parseDestinationUrls(url, ["SCL"], "production");
    expect(result.urls).toEqual({});
    expect(result.errors[0]).toContain("staging");
  });

  it("rejects external domains, non-HTTPS and non-document paths", () => {
    const result = parseDestinationUrls([
      "https://evil.example/documents/d/guest/scl_750x500_1",
      "http://www.smiles.com.br/documents/d/guest/scl_750x500_1",
      "https://www.smiles.com.br/image/scl_750x500_1",
    ].join("\n"), ["SCL"]);
    expect(result.urls).toEqual({});
    expect(result.errors).toHaveLength(3);
  });

  it("does not choose between two competing URLs for one IATA", () => {
    const result = parseDestinationUrls([
      "https://www.smiles.com.br/documents/d/guest/scl_750x500_1",
      "https://www.smiles.com.br/documents/d/guest/scl_750x500_2",
    ].join("\n"), ["SCL"]);
    expect(result.errors).toHaveLength(1);
    expect(result.urls.SCL).toBeUndefined();
  });
});
