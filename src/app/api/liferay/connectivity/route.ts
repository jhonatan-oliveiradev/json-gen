import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import { liferayConfigFor } from "@/integrations/liferay/client";
import { describeLiferayNetworkError } from "@/integrations/liferay/network-errors";

export const runtime = "nodejs";

const schema = z.object({
  environment: z.enum(["production", "staging-green", "staging-blue"]),
});

export async function POST(request: Request) {
  let environment: z.infer<typeof schema>["environment"];
  try {
    environment = schema.parse(await request.json()).environment;
  } catch {
    return NextResponse.json({ ok: false, stage: "configuration", message: "Ambiente inválido." }, { status: 400 });
  }

  let config: ReturnType<typeof liferayConfigFor>;
  try {
    config = liferayConfigFor(environment);
  } catch (error) {
    return NextResponse.json({
      ok: false, stage: "configuration", message: error instanceof Error ? error.message : "Configuração inválida.",
    });
  }

  const hostname = new URL(config.baseUrl).hostname;
  const source = { environment, hostname, siteId: config.siteId };

  try {
    await lookup(hostname);
  } catch (error) {
    const info = describeLiferayNetworkError(error);
    return NextResponse.json({ ok: false, source, stage: "dns", ...info });
  }

  const url = `${config.baseUrl}/o/headless-delivery/v1.0/sites/${config.siteId}/document-folders?pageSize=1`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const httpStatus = response.status;
    await response.body?.cancel();

    if (httpStatus >= 300 && httpStatus < 400) {
      return NextResponse.json({
        ok: false, source, stage: "http", httpStatus,
        hint: "O Liferay respondeu com redirecionamento; verifique SSO/autenticação da API.",
      });
    }
    if (httpStatus === 401 || httpStatus === 403) {
      return NextResponse.json({
        ok: false, source, stage: "http", httpStatus,
        hint: "Rede acessível, mas a API Headless exige autorização.",
      });
    }
    if (httpStatus === 404) {
      return NextResponse.json({
        ok: false, source, stage: "http", httpStatus,
        hint: "O host está acessível, mas o endpoint/site ID pode estar incorreto.",
      });
    }
    return NextResponse.json({
      ok: response.ok, source, stage: "http", httpStatus,
      hint: response.ok
        ? "Host e API Headless acessíveis pela Vercel. Se imagens faltam, continue investigando pastas e metadados."
        : "O Liferay retornou um erro HTTP. Confira o endpoint, site ID e a configuração do servidor.",
    });
  } catch (error) {
    const info = describeLiferayNetworkError(error);
    return NextResponse.json({ ok: false, source, stage: "connection", ...info });
  }
}
