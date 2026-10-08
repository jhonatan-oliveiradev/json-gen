import * as XLSX from "xlsx";
import { parseCampaignRows, type CampaignRow } from "./parse-rows";
import type { ParsedCampaign } from "./types";

export function parseCampaignWorkbook(buffer: ArrayBuffer, sourceName?: string | null): ParsedCampaign {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha não possui nenhuma aba legível.");

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<CampaignRow>(worksheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  return parseCampaignRows(rows, sourceName);
}
