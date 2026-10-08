import { normalizeKey } from "@/domain/campaign/normalize";
import type { NormalizedOffer } from "@/domain/campaign/types";
import type { CampaignSummary, OfferGroup } from "./types";

function destinationName(label: string, iata: string) {
  return label.replace(new RegExp(`\\s*\\(${iata}\\)\\s*$`, "i"), "").trim() || iata;
}

export function groupOffers(offers: NormalizedOffer[]): OfferGroup[] {
  const groups = new Map<string, OfferGroup>();

  for (const offer of offers) {
    if (offer.dropdown.type === "single") {
      const id = `single:${offer.sourceRow}`;
      groups.set(id, {
        id,
        kind: "single",
        carousel: offer.carousel,
        label: `${offer.origin.iata} → ${offer.destination.iata}`,
        destinationIata: offer.destination.iata,
        offers: [offer],
      });
      continue;
    }

    const normalizedKey = normalizeKey(offer.dropdown.key);
    const id = `dropdown:${normalizeKey(offer.carousel)}:${normalizedKey}`;
    const existing = groups.get(id);

    if (existing) {
      existing.offers.push(offer);
    } else {
      groups.set(id, {
        id,
        kind: "dropdown",
        carousel: offer.carousel,
        label: destinationName(offer.destination.label, offer.destination.iata),
        destinationIata: offer.destination.iata,
        offers: [offer],
      });
    }
  }

  return Array.from(groups.values());
}

export function summarizeCampaign(offers: NormalizedOffer[], groups = groupOffers(offers)): CampaignSummary {
  return {
    offerCount: offers.length,
    carouselCount: new Set(offers.map((offer) => offer.carousel)).size,
    dropdownCount: groups.filter((group) => group.kind === "dropdown").length,
    standaloneCount: groups.filter((group) => group.kind === "single").length,
    airlineCount: new Set(offers.map((offer) => normalizeKey(offer.airline))).size,
  };
}
