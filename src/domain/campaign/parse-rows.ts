import { cleanText, extractCampaignCode, normalizeKey, nullableText, parseDropdown } from "./normalize";
import type { NormalizedOffer, ParsedCampaign } from "./types";

export type CampaignCell = string | number | boolean | Date | null | undefined;
export type CampaignRow = CampaignCell[];

const REQUIRED_HEADERS = ["ORIGEM", "DESTINO", "CIA AEREA", "CATEGORIA DESTINO", "SAIDA", "LINK"];

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const wholeDays = Math.floor(serial);
  const milliseconds = Date.UTC(1899, 11, 30) + wholeDays * 86_400_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCampaignDate(value: CampaignCell): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getUTCDate()).padStart(2, "0")}/${String(value.getUTCMonth() + 1).padStart(2, "0")}/${value.getUTCFullYear()}`;
  }

  if (typeof value === "number") {
    const date = excelSerialToDate(value);
    if (date) return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  }

  const text = cleanText(value);
  if (!text) return "";

  const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (br) return `${br[1].padStart(2, "0")}/${br[2].padStart(2, "0")}/${br[3]}`;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;

  return text;
}

function findHeaderRow(rows: CampaignRow[]): number {
  const index = rows.findIndex((row) => {
    const normalized = row.map(normalizeKey);
    return REQUIRED_HEADERS.every((header) => normalized.includes(header));
  });
  if (index < 0) throw new Error("Não foi possível localizar a linha de cabeçalho da planilha.");
  return index;
}

function allHeaderIndexes(header: CampaignRow, name: string): number[] {
  const target = normalizeKey(name);
  return header.reduce<number[]>((acc, cell, index) => {
    if (normalizeKey(cell) === target) acc.push(index);
    return acc;
  }, []);
}

function headerIndex(header: CampaignRow, name: string): number {
  return allHeaderIndexes(header, name)[0] ?? -1;
}

function cell(row: CampaignRow, index: number): CampaignCell {
  return index >= 0 ? row[index] : "";
}

function buildIndexes(header: CampaignRow) {
  const originLabel = headerIndex(header, "ORIGEM");
  const destinationLabel = headerIndex(header, "DESTINO");
  const general100 = allHeaderIndexes(header, "GERAL 100%");
  const namedOriginIata = headerIndex(header, "IATA ORIGEM");
  const namedDestinationIata = headerIndex(header, "IATA DESTINO");
  const namedCustomerTotal = headerIndex(header, "GERAL TOTAL");

  return {
    position: headerIndex(header, "POSIÇÃO"),
    originLabel,
    originIata: namedOriginIata >= 0 ? namedOriginIata : Math.max(0, originLabel - 1),
    destinationLabel,
    destinationIata: namedDestinationIata >= 0 ? namedDestinationIata : Math.max(0, destinationLabel - 1),
    airline: headerIndex(header, "CIA AEREA"),
    carousel: headerIndex(header, "CATEGORIA DESTINO"),
    dropdown: headerIndex(header, "DROPDOWN"),
    connection: headerIndex(header, "CONEXÃO"),
    generalDiscount: headerIndex(header, "DESCONTO GERAL"),
    clubDiscount: headerIndex(header, "DESCONTO CLUBE"),
    original: headerIndex(header, "DE"),
    club: headerIndex(header, "CLUBE 100%"),
    clubSmilesAndMoney: headerIndex(header, "CLUBE S&M"),
    clubTotal: headerIndex(header, "CLUBE TOTAL"),
    club12x: headerIndex(header, "CLUBE 12X"),
    smiles: general100[0] ?? -1,
    customerSmilesAndMoney: headerIndex(header, "GERAL S&M"),
    customerTotal: namedCustomerTotal >= 0 ? namedCustomerTotal : (general100[1] ?? -1),
    customer12x: headerIndex(header, "GERAL 12X"),
    departure: headerIndex(header, "SAÍDA"),
    flightLink: headerIndex(header, "LINK"),
    hotelLink: headerIndex(header, "LINK HOTEL"),
  };
}

function looksLikeOffer(row: CampaignRow, indexes: ReturnType<typeof buildIndexes>) {
  return Boolean(
    cleanText(cell(row, indexes.originLabel)) &&
      cleanText(cell(row, indexes.destinationLabel)) &&
      cleanText(cell(row, indexes.airline)) &&
      cleanText(cell(row, indexes.carousel)),
  );
}

export function parseCampaignRows(rows: CampaignRow[], sourceName?: string | null): ParsedCampaign {
  const headerRowIndex = findHeaderRow(rows);
  const header = rows[headerRowIndex];
  const indexes = buildIndexes(header);

  const offers: NormalizedOffer[] = rows
    .slice(headerRowIndex + 1)
    .map((row, offset) => ({ row, sourceRow: headerRowIndex + offset + 2 }))
    .filter(({ row }) => looksLikeOffer(row, indexes))
    .map(({ row, sourceRow }) => ({
      sourceRow,
      position: cleanText(cell(row, indexes.position)),
      carousel: cleanText(cell(row, indexes.carousel)),
      origin: { label: cleanText(cell(row, indexes.originLabel)), iata: normalizeKey(cell(row, indexes.originIata)) },
      destination: { label: cleanText(cell(row, indexes.destinationLabel)), iata: normalizeKey(cell(row, indexes.destinationIata)) },
      airline: cleanText(cell(row, indexes.airline)),
      connection: nullableText(cell(row, indexes.connection)),
      dropdown: parseDropdown(cell(row, indexes.dropdown)),
      departureDate: formatCampaignDate(cell(row, indexes.departure)),
      pricing: {
        original: cleanText(cell(row, indexes.original)),
        clubDiscount: cleanText(cell(row, indexes.clubDiscount)),
        club: cleanText(cell(row, indexes.club)),
        smilesDiscount: nullableText(cell(row, indexes.generalDiscount)),
        smiles: nullableText(cell(row, indexes.smiles)),
        customer12x: nullableText(cell(row, indexes.customer12x)),
        customerSmilesAndMoney: nullableText(cell(row, indexes.customerSmilesAndMoney)),
        customerTotal: nullableText(cell(row, indexes.customerTotal)),
        club12x: nullableText(cell(row, indexes.club12x)),
        clubSmilesAndMoney: nullableText(cell(row, indexes.clubSmilesAndMoney)),
        clubTotal: nullableText(cell(row, indexes.clubTotal)),
      },
      links: { flight: cleanText(cell(row, indexes.flightLink)), hotel: cleanText(cell(row, indexes.hotelLink)) },
    }));

  return {
    campaignCode: extractCampaignCode(sourceName),
    offers,
    carousels: Array.from(new Set(offers.map((offer) => offer.carousel))),
    airlines: Array.from(new Set(offers.map((offer) => offer.airline))),
  };
}
