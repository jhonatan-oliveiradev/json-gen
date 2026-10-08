import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseCampaignWorkbook } from "./parse-xlsx";
import { groupOffers, summarizeCampaign } from "@/domain/grouping/group-offers";

const header = [
  "Posição", "", "ORIGEM", "", "DESTINO", "CIA AEREA", "Categoria Destino", "Dropdown", "Conexão",
  "DESCONTO GERAL", "DESCONTO CLUBE", "DE", "CLUBE 100%", "CLUBE S&M", "CLUBE TOTAL", "CLUBE 12X",
  "GERAL 100%", "GERAL S&M", "GERAL TOTAL", "GERAL 12x", "Saída", "Link", "Link hotel",
];

function makeWorkbookBuffer() {
  const rows = [
    ["Campanha aérea — linha editorial acima da tabela"],
    [],
    header,
    ["1º", "GRU", "São Paulo (GRU)", "MIA", "Miami (MIA)", "AMERICAN", "CARROSSEL 1 - AMÉRICA DO NORTE", "DROPDOWN MIA", "", "", "10%", "", "50.100", "", "", "", "", "", "", "", "16/03/2027", "https://example.com/1", ""],
    ["2º", "GIG", "Rio de Janeiro (GIG)", "MIA", "Miami (MIA)", "AMERICAN", "CARROSSEL 1 - AMÉRICA DO NORTE", "DROPDOWN MIA", "", "", "10%", "", "51.200", "", "", "", "", "", "", "", "17/03/2027", "https://example.com/2", ""],
    ["1º", "GRU", "São Paulo (GRU)", "LIS", "Lisboa (LIS)", "TAP Portugal", "CARROSSEL 2 - EUROPA", "SOLTA", "", "", "", "", "70.000", "", "", "", "", "", "", "", "18/03/2027", "https://example.com/3", ""],
    [],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Ofertas");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parseCampaignWorkbook", () => {
  it("discovers the table after leading rows and ignores trailing blank rows", () => {
    const campaign = parseCampaignWorkbook(makeWorkbookBuffer(), "AER9999_destinos.xlsx");
    expect(campaign.offers).toHaveLength(3);
    expect(campaign.carousels).toEqual([
      "CARROSSEL 1 - AMÉRICA DO NORTE",
      "CARROSSEL 2 - EUROPA",
    ]);
    expect(campaign.campaignCode).toBe("AER9999");
  });

  it("preserves dropdown membership while standalone rows stay independent", () => {
    const campaign = parseCampaignWorkbook(makeWorkbookBuffer(), "AER9999_destinos.xlsx");
    const groups = groupOffers(campaign.offers);
    expect(summarizeCampaign(campaign.offers, groups)).toMatchObject({
      offerCount: 3,
      carouselCount: 2,
      dropdownCount: 1,
      standaloneCount: 1,
      airlineCount: 2,
    });
    expect(groups.find((group) => group.kind === "dropdown")?.offers).toHaveLength(2);
  });

  it("extracts IATAs, dates and display values", () => {
    const campaign = parseCampaignWorkbook(makeWorkbookBuffer(), "AER9999_destinos.xlsx");
    expect(campaign.offers[0]).toMatchObject({
      carousel: "CARROSSEL 1 - AMÉRICA DO NORTE",
      origin: { label: "São Paulo (GRU)", iata: "GRU" },
      destination: { label: "Miami (MIA)", iata: "MIA" },
      airline: "AMERICAN",
      departureDate: "16/03/2027",
      dropdown: { type: "group", key: "MIA", raw: "DROPDOWN MIA" },
    });
  });
});
