import { NextResponse } from "next/server";
import { z } from "zod";
import { findFolderByName, listFolderDocuments } from "@/integrations/liferay/client";
import { resolveAirlineAsset, resolveDestinationAsset } from "@/integrations/liferay/resolve-assets";

const requestSchema = z.object({
  folderName: z.string().trim().min(1),
  mode: z.enum(["destination", "airline"]),
  environment: z.enum(["production", "staging-green", "staging-blue"]).default("production"),
  values: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const folder = await findFolderByName(body.folderName, body.environment);

    if (!folder) {
      return NextResponse.json({ ok: false, code: "folder-not-found", message: `Pasta “${body.folderName}” não encontrada no ambiente ${body.environment}.` }, { status: 404 });
    }

    const listing = await listFolderDocuments(folder.id, body.environment);
    const documents = listing.documents;
    const uniqueValues = Array.from(new Set(body.values));
    const resolutions = Object.fromEntries(
      uniqueValues.map((value) => [
        value,
        body.mode === "destination"
          ? resolveDestinationAsset(value, documents)
          : resolveAirlineAsset(value, documents),
      ]),
    );

    return NextResponse.json({ ok: true, folder, documentCount: documents.length, diagnostics: listing.diagnostics, resolutions });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, code: "invalid-request", message: "Parâmetros inválidos para resolver assets." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Falha desconhecida ao consultar o Liferay.";
    return NextResponse.json({ ok: false, code: "liferay-request-failed", message }, { status: 500 });
  }
}
