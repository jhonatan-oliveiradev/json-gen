import { normalizeKey } from "@/domain/campaign/normalize";
import type { NormalizedOffer } from "@/domain/campaign/types";
import { generateOfferId } from "@/domain/export/generate-id";
import type { ValidationInput, ValidationIssue, ValidationReport } from "./types";

export function destinationAssetKey(offer: NormalizedOffer): string {
  return `${normalizeKey(offer.carousel)}:${offer.destination.iata}`;
}

export function airlineAssetKey(offer: NormalizedOffer): string {
  return normalizeKey(offer.airline);
}

function issue(code: string, severity: "error" | "warning", message: string, sourceRows?: number[]): ValidationIssue {
  return { code, severity, message, sourceRows };
}

export function validateCampaign({ offers, groups, assets }: ValidationInput): ValidationReport {
  const issues: ValidationIssue[] = [];

  for (const offer of offers) {
    if (!offer.origin.iata || !offer.destination.iata) {
      issues.push(issue("iata-missing", "error", `Linha ${offer.sourceRow}: origem ou destino sem IATA.`, [offer.sourceRow]));
    } else if (!/^[A-Z0-9]{3}$/.test(offer.origin.iata) || !/^[A-Z0-9]{3}$/.test(offer.destination.iata)) {
      issues.push(issue("iata-invalid", "error", `Linha ${offer.sourceRow}: IATA deve ter exatamente 3 caracteres.`, [offer.sourceRow]));
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(offer.departureDate)) {
      issues.push(issue("departure-date-invalid", "error", `Linha ${offer.sourceRow}: data de saída inválida.`, [offer.sourceRow]));
    }
    if (!offer.links.flight) {
      issues.push(issue("flight-link-missing", "error", `Linha ${offer.sourceRow}: link de emissão ausente.`, [offer.sourceRow]));
    }

    const destinationKey = destinationAssetKey(offer);
    if (!assets.destinations[destinationKey]) {
      const reason = assets.destinationErrors?.[destinationKey];
      issues.push(issue(
        reason === "ambiguous" ? "destination-image-ambiguous" : "destination-image-missing",
        "error",
        `${offer.destination.iata}: imagem de destino ${reason === "ambiguous" ? "ambígua" : "não encontrada"} para ${offer.carousel}.`,
        [offer.sourceRow],
      ));
    }

    const airlineKey = airlineAssetKey(offer);
    if (!assets.airlines[airlineKey]) {
      const reason = assets.airlineErrors?.[airlineKey];
      issues.push(issue(
        reason === "ambiguous" ? "airline-logo-ambiguous" : "airline-logo-missing",
        "error",
        `${offer.airline}: logo ${reason === "ambiguous" ? "ambíguo" : "não encontrado"}.`,
        [offer.sourceRow],
      ));
    }
  }

  for (const group of groups.filter((item) => item.kind === "dropdown")) {
    const destinations = new Set(group.offers.map((offer) => offer.destination.iata));
    if (destinations.size > 1) {
      issues.push(issue(
        "dropdown-destination-mismatch",
        "error",
        `${group.label}: o dropdown mistura destinos (${Array.from(destinations).join(", ")}).`,
        group.offers.map((offer) => offer.sourceRow),
      ));
    }
  }

  const ids = new Map<string, number[]>();
  for (const offer of offers) {
    const id = generateOfferId(offer);
    ids.set(id, [...(ids.get(id) ?? []), offer.sourceRow]);
  }
  for (const [id, rows] of ids) {
    if (rows.length > 1) {
      issues.push(issue("duplicate-id", "error", `ID duplicado: ${id}.`, rows));
    }
  }

  const routeGroups = new Map<string, NormalizedOffer[]>();
  for (const offer of offers) {
    const key = `${normalizeKey(offer.carousel)}:${offer.origin.iata}:${offer.destination.iata}`;
    routeGroups.set(key, [...(routeGroups.get(key) ?? []), offer]);
  }
  for (const variants of routeGroups.values()) {
    if (variants.length > 1) {
      const signatures = new Set(variants.map((offer) => `${offer.departureDate}:${offer.pricing.club}:${offer.pricing.smiles ?? ""}`));
      if (signatures.size > 1) {
        issues.push(issue(
          "route-variant",
          "warning",
          `${variants[0].origin.iata} → ${variants[0].destination.iata} aparece ${variants.length} vezes com data/preço diferentes; todas serão mantidas.`,
          variants.map((offer) => offer.sourceRow),
        ));
      }
    }
  }

  const unique = new Map<string, ValidationIssue>();
  for (const current of issues) {
    const key = `${current.code}:${current.message}`;
    if (!unique.has(key)) unique.set(key, current);
  }

  const deduped = Array.from(unique.values());
  const errors = deduped.filter((item) => item.severity === "error");
  const warnings = deduped.filter((item) => item.severity === "warning");
  return { errors, warnings, issues: deduped, canExport: errors.length === 0 };
}
