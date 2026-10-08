import { describe, expect, it } from "vitest";
import { groupOffers } from "./group-offers";
import type { NormalizedOffer } from "@/domain/campaign/types";

const base = (overrides: Partial<NormalizedOffer>): NormalizedOffer => ({
  sourceRow: 2,
  carousel: "CARROSSEL 1",
  position: "1º",
  origin: { label: "São Paulo (GRU)", iata: "GRU" },
  destination: { label: "Miami (MIA)", iata: "MIA" },
  airline: "AMERICAN",
  connection: null,
  dropdown: { type: "single" },
  departureDate: "16/03/2027",
  pricing: {
    original: "", clubDiscount: "10%", club: "50.100", smilesDiscount: null, smiles: null,
    customer12x: null, customerSmilesAndMoney: null, customerTotal: null,
    club12x: null, clubSmilesAndMoney: null, clubTotal: null,
  },
  links: { flight: "https://example.com", hotel: "" },
  ...overrides,
});

describe("groupOffers", () => {
  it("keeps standalone offers independent", () => {
    const groups = groupOffers([base({ sourceRow: 2 }), base({ sourceRow: 3, destination: { label: "Orlando (MCO)", iata: "MCO" } })]);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.kind === "single")).toBe(true);
  });

  it("groups dropdowns by carousel and key", () => {
    const dropdown = { type: "group" as const, key: "MIA", raw: "DROPDOWN MIA" };
    const groups = groupOffers([
      base({ sourceRow: 2, dropdown }),
      base({ sourceRow: 3, origin: { label: "Rio de Janeiro (GIG)", iata: "GIG" }, dropdown }),
      base({ sourceRow: 4, carousel: "CARROSSEL 2", dropdown }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].offers).toHaveLength(2);
    expect(groups[1].offers).toHaveLength(1);
  });

  it("preserves repeated route variants", () => {
    const dropdown = { type: "group" as const, key: "BCN", raw: "DROPDOWN BCN" };
    const groups = groupOffers([
      base({ sourceRow: 2, dropdown, destination: { label: "Barcelona (BCN)", iata: "BCN" }, departureDate: "20/11/2026" }),
      base({ sourceRow: 3, dropdown, destination: { label: "Barcelona (BCN)", iata: "BCN" }, departureDate: "21/11/2026", pricing: { ...base({}).pricing, club: "180.600" } }),
    ]);
    expect(groups[0].offers).toHaveLength(2);
  });
});
