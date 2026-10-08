import { describe, expect, it } from "vitest";
import { resolveDestinationAsset } from "./resolve-assets";
import type { LiferayDocument } from "./types";

describe("resolveDestinationAsset", () => {
  const titles = [
    "SCL_750x500_1",
    "PUQ_750x500_1",
    "LIM_750x500_01",
    "CUZ_750x500_1",
    "CJC_750x500_1",
    "ZAL_750x500_1",
  ];
  const documents: LiferayDocument[] = titles.map((title, index) => ({
    id: index + 1,
    title,
    contentUrl: `https://portal-green-stg-svc.smiles.com.br/documents/d/guest/${title.toLowerCase()}`,
  }));

  it("matches the six AER1525 carousel 1 destinations by case-insensitive IATA prefix", () => {
    for (const iata of ["SCL", "PUQ", "LIM", "CUZ", "CJC", "ZAL"]) {
      const result = resolveDestinationAsset(iata, documents);
      expect(result.status).toBe("resolved");
    }
  });

  it("refuses unrelated file titles", () => {
    expect(resolveDestinationAsset("MIA", documents).status).toBe("missing");
  });

  it("keeps multiple matching files ambiguous rather than selecting arbitrarily", () => {
    const result = resolveDestinationAsset("SCL", [
      ...documents,
      { id: 99, title: "SCL_750x500_2", contentUrl: "https://www.smiles.com.br/documents/d/guest/scl_750x500_2" },
    ]);
    expect(result.status).toBe("ambiguous");
  });
});
