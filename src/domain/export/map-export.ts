import type { NormalizedOffer } from "@/domain/campaign/types";
import type { ExportOffer } from "./export-schema";
import { generateOfferId } from "./generate-id";

export type ResolvedAssets = {
  destinationImageUrl: string;
  airlineLogoUrl: string;
};

export function mapOfferToExport(offer: NormalizedOffer, assets: ResolvedAssets): ExportOffer {
  const result: ExportOffer = {
    id: generateOfferId(offer),
    categoria_destino: offer.carousel,
    Origem: offer.origin.label,
    iata_origem: offer.origin.iata,
    Destino: offer.destination.label,
    iata_destino: offer.destination.iata,
    Cia: offer.airline,
    conexao: offer.connection,
    dropdown: offer.dropdown.type === "single" ? "SOLTA" : offer.dropdown.raw,
    valor_original: offer.pricing.original,
    clube_desconto: offer.pricing.clubDiscount,
    Clube: offer.pricing.club,
    smiles_desconto: offer.pricing.smilesDiscount,
    Smiles: offer.pricing.smiles,
    data_saida: offer.departureDate,
    cliente_12x: offer.pricing.customer12x,
    cliente_smiles_and_money: offer.pricing.customerSmilesAndMoney,
    cliente_total: offer.pricing.customerTotal,
    clube_12x: offer.pricing.club12x,
    clube_smiles_and_money: offer.pricing.clubSmilesAndMoney,
    clube_total: offer.pricing.clubTotal,
    Links: offer.links.flight,
    link_hotel: offer.links.hotel,
    link_img_desk: assets.destinationImageUrl,
    link_img_mobile: assets.destinationImageUrl,
    link_img_cia_aerea: assets.airlineLogoUrl,
  };

  return result;
}
