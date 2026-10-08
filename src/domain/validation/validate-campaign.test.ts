import { describe, expect, it } from "vitest";
import { validateCampaign } from "./validate-campaign";
import type { NormalizedOffer } from "@/domain/campaign/types";
import type { OfferGroup } from "@/domain/grouping/types";

const offer: NormalizedOffer = {
  sourceRow: 2,
  position: "1º",
  carousel: "CARROSSEL 1",
  origin: { label: "São Paulo (GRU)", iata: "GRU" },
  destination: { label: "Miami (MIA)", iata: "MIA" },
  airline: "AMERICAN",
  connection: null,
  dropdown: { type: "single" },
  departureDate: "16/03/2027",
  pricing: { original: "", clubDiscount: "10%", club: "50.100", smilesDiscount: null, smiles: null, customer12x: null, customerSmilesAndMoney: null, customerTotal: null, club12x: null, clubSmilesAndMoney: null, clubTotal: null },
  links: { flight: "https://example.com", hotel: "" },
};

const groups: OfferGroup[] = [{ id: "single:2", kind: "single", carousel: "CARROSSEL 1", label: "Miami", destinationIata: "MIA", offers: [offer] }];

describe("validateCampaign", () => {
  it("blocks export when required assets are missing", () => {
    const report = validateCampaign({ offers: [offer], groups, assets: { destinations: {}, airlines: {} } });
    expect(report.canExport).toBe(false);
    expect(report.issues.some((issue) => issue.code === "destination-image-missing")).toBe(true);
  });

  it("blocks malformed IATA values", () => {
    const malformed = { ...offer, destination: { label: "Miami (MIAX)", iata: "MIAX" } };
    const malformedGroups: OfferGroup[] = [{ ...groups[0], offers: [malformed], destinationIata: "MIAX" }];
    const report = validateCampaign({
      offers: [malformed],
      groups: malformedGroups,
      assets: { destinations: { "CARROSSEL 1:MIAX": "https://example.com/mia" }, airlines: { AMERICAN: "https://example.com/american" } },
    });
    expect(report.issues.some((item) => item.code === "iata-invalid")).toBe(true);
    expect(report.canExport).toBe(false);
  });

  it("allows a valid offer with resolved assets", () => {
    const report = validateCampaign({
      offers: [offer], groups,
      assets: { destinations: { "CARROSSEL 1:MIA": "https://example.com/mia" }, airlines: { "AMERICAN": "https://example.com/american" } },
    });
    expect(report.errors).toHaveLength(0);
    expect(report.canExport).toBe(true);
  });
});
