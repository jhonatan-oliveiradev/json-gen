import type { NormalizedOffer } from "@/domain/campaign/types";

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dateSuffix(date: string): string {
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return slug(date);
  return `${match[3]}_${match[2]}_${match[1]}`;
}

export function generateOfferId(offer: NormalizedOffer): string {
  return `${slug(offer.origin.label)}${slug(offer.destination.label)}_${dateSuffix(offer.departureDate)}`;
}
