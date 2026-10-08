import type { NormalizedOffer } from "@/domain/campaign/types";

export type OfferGroup = {
  id: string;
  kind: "single" | "dropdown";
  carousel: string;
  label: string;
  destinationIata: string;
  offers: NormalizedOffer[];
};

export type CampaignSummary = {
  offerCount: number;
  carouselCount: number;
  dropdownCount: number;
  standaloneCount: number;
  airlineCount: number;
};
