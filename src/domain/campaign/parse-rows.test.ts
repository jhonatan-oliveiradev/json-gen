import { describe, expect, it } from "vitest";
import { formatCampaignDate, parseCampaignRows } from "./parse-rows";

const header = ["Posição", "", "ORIGEM", "", "DESTINO", "CIA AEREA", "Categoria Destino", "Dropdown", "Conexão", "DESCONTO GERAL", "DESCONTO CLUBE", "DE", "CLUBE 100%", "CLUBE S&M", "CLUBE TOTAL", "CLUBE 12X", "GERAL 100%", "GERAL S&M", "GERAL 100%", "GERAL 12x", "Saída", "Link", "Link hotel"];

describe("parseCampaignRows", () => {
  it("finds a header after leading rows and treats blank/solta dropdowns as independent", () => {
    const result = parseCampaignRows([
      ["Título da campanha"],
      header,
      ["1º", "GRU", "São Paulo (GRU)", "MIA", "Miami (MIA)", "AMERICAN", "CARROSSEL 2", " solta ", "", "", "10%", "", "50.100", "", "", "", "", "", "", "", "16/03/2027", "https://example.com/1", ""],
      ["2º", "GIG", "Rio de Janeiro (GIG)", "MIA", "Miami (MIA)", "AMERICAN", "CARROSSEL 2", "", "", "", "10%", "", "51.200", "", "", "", "", "", "", "", "17/03/2027", "https://example.com/2", ""],
    ], "AER9999_destinos.xlsx");

    expect(result.offers).toHaveLength(2);
    expect(result.offers.every((offer) => offer.dropdown.type === "single")).toBe(true);
    expect(result.campaignCode).toBe("AER9999");
  });

  it("normalizes Excel serial and text dates to DD/MM/YYYY", () => {
    expect(formatCampaignDate("8/11/2026")).toBe("08/11/2026");
    expect(formatCampaignDate(46334)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});
