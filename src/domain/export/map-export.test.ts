import { describe, expect, it } from "vitest";
import { generateOfferId } from "./generate-id";
import { mapOfferToExport } from "./map-export";
import type { NormalizedOffer } from "@/domain/campaign/types";

const offer: NormalizedOffer = {
  sourceRow: 2,
  position: "1º",
  carousel: "CARROSSEL 1",
  origin: { label: "São Paulo (CGH)", iata: "CGH" },
  destination: { label: "Belo Horizonte (CNF)", iata: "CNF" },
  airline: "GOL",
  connection: null,
  dropdown: { type: "single" },
  departureDate: "22/02/2027",
  pricing: {
    original: "",
    clubDiscount: "",
    club: "7.600",
    smilesDiscount: null,
    smiles: null,
    customer12x: null,
    customerSmilesAndMoney: null,
    customerTotal: null,
    club12x: null,
    clubSmilesAndMoney: null,
    clubTotal: null,
  },
  links: { flight: "https://example.com/emissao", hotel: "" },
};

describe("production export mapping", () => {
  it("generates deterministic accent-normalized IDs", () => {
    expect(generateOfferId(offer)).toBe("sao_paulo_cghbelo_horizonte_cnf_2027_02_22");
  });

  it("maps the production field contract without inventing asset URLs", () => {
    const result = mapOfferToExport(offer, {
      destinationImageUrl: "https://example.com/documents/cnf_750x500_1",
      airlineLogoUrl: "https://example.com/documents/gol",
    });

    expect(result).toEqual({
      id: "sao_paulo_cghbelo_horizonte_cnf_2027_02_22",
      categoria_destino: "CARROSSEL 1",
      Origem: "São Paulo (CGH)",
      iata_origem: "CGH",
      Destino: "Belo Horizonte (CNF)",
      iata_destino: "CNF",
      Cia: "GOL",
      conexao: null,
      dropdown: "SOLTA",
      valor_original: "",
      clube_desconto: "",
      Clube: "7.600",
      smiles_desconto: null,
      Smiles: null,
      data_saida: "22/02/2027",
      cliente_12x: null,
      cliente_smiles_and_money: null,
      cliente_total: null,
      clube_12x: null,
      clube_smiles_and_money: null,
      clube_total: null,
      Links: "https://example.com/emissao",
      link_hotel: "",
      link_img_desk: "https://example.com/documents/cnf_750x500_1",
      link_img_mobile: "https://example.com/documents/cnf_750x500_1",
      link_img_cia_aerea: "https://example.com/documents/gol",
    });
  });
});
