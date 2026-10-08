import type { NormalizedOffer } from "@/domain/campaign/types";
import type { OfferGroup } from "@/domain/grouping/types";

export type AssetCatalog = {
  destinations: Record<string, string>;
  airlines: Record<string, string>;
  destinationErrors?: Record<string, "missing" | "ambiguous">;
  airlineErrors?: Record<string, "missing" | "ambiguous">;
};

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  sourceRows?: number[];
};

export type ValidationInput = {
  offers: NormalizedOffer[];
  groups: OfferGroup[];
  assets: AssetCatalog;
};

export type ValidationReport = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
  canExport: boolean;
};
