export type DropdownInfo =
  | { type: "single" }
  | { type: "group"; key: string; raw: string };

export type OfferPricing = {
  original: string;
  clubDiscount: string;
  club: string;
  smilesDiscount: string | null;
  smiles: string | null;
  customer12x: string | null;
  customerSmilesAndMoney: string | null;
  customerTotal: string | null;
  club12x: string | null;
  clubSmilesAndMoney: string | null;
  clubTotal: string | null;
};

export type NormalizedOffer = {
  sourceRow: number;
  position: string;
  carousel: string;
  origin: { label: string; iata: string };
  destination: { label: string; iata: string };
  airline: string;
  connection: string | null;
  dropdown: DropdownInfo;
  departureDate: string;
  pricing: OfferPricing;
  links: { flight: string; hotel: string };
};

export type ParsedCampaign = {
  campaignCode: string | null;
  offers: NormalizedOffer[];
  carousels: string[];
  airlines: string[];
};
