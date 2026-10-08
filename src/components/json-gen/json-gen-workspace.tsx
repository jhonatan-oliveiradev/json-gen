"use client";

import { useMemo, useState } from "react";
import { parseCampaignWorkbook } from "@/domain/campaign/parse-xlsx";
import { extractCarouselNumber, normalizeKey } from "@/domain/campaign/normalize";
import type { ParsedCampaign } from "@/domain/campaign/types";
import { groupOffers, summarizeCampaign } from "@/domain/grouping/group-offers";
import { mapOfferToExport } from "@/domain/export/map-export";
import { exportOfferSchema } from "@/domain/export/export-schema";
import { airlineAssetKey, destinationAssetKey, validateCampaign } from "@/domain/validation/validate-campaign";
import type { AssetCatalog } from "@/domain/validation/types";
import { parseDestinationUrls } from "@/integrations/liferay/manual-assets";

type Resolution =
  | { status: "resolved"; url: string; documentId: number | string; title: string }
  | { status: "missing"; candidates: string[] }
  | { status: "ambiguous"; candidates: Array<{ id: number | string; title: string; url: string }> };

type LiferayEnvironment = "production" | "staging-green" | "staging-blue";

type ResolveResponse =
  | { ok: true; folder: { id: number | string; name: string }; documentCount: number; resolutions: Record<string, Resolution> }
  | { ok: false; code: string; message: string };

const EMPTY_ASSETS: AssetCatalog = { destinations: {}, airlines: {}, destinationErrors: {}, airlineErrors: {} };

function suggestFolder(campaignCode: string | null, carousel: string) {
  const number = extractCarouselNumber(carousel);
  if (!campaignCode || number === null) return "";
  return `${campaignCode.toLowerCase()}_offers_${String(number).padStart(2, "0")}_v1`;
}

function exportFileName(campaign: ParsedCampaign, carousel: string) {
  const number = extractCarouselNumber(carousel) ?? campaign.carousels.indexOf(carousel) + 1;
  return `${campaign.campaignCode ?? "CAMPANHA"}_OFFERS${String(number).padStart(2, "0")}.json`;
}

async function resolveFolder(folderName: string, mode: "destination" | "airline", values: string[], environment: LiferayEnvironment): Promise<ResolveResponse> {
  const response = await fetch("/api/liferay/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderName, mode, values, environment }),
  });
  return response.json();
}

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 4)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function JsonGenWorkspace() {
  const [campaign, setCampaign] = useState<ParsedCampaign | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeCarousel, setActiveCarousel] = useState("");
  const [folders, setFolders] = useState<Record<string, string>>({});
  const [airlineFolder, setAirlineFolder] = useState("default_cias_v5");
  const [environment, setEnvironment] = useState<LiferayEnvironment>("production");
  const [assets, setAssets] = useState<AssetCatalog>(EMPTY_ASSETS);
  const [resolving, setResolving] = useState(false);
  const [resolvedOnce, setResolvedOnce] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const [manualMessage, setManualMessage] = useState("");
  const [resolutionMessages, setResolutionMessages] = useState<string[]>([]);

  const groups = useMemo(() => campaign ? groupOffers(campaign.offers) : [], [campaign]);
  const summary = useMemo(() => campaign ? summarizeCampaign(campaign.offers, groups) : null, [campaign, groups]);
  const activeOffers = useMemo(() => campaign?.offers.filter((offer) => offer.carousel === activeCarousel) ?? [], [campaign, activeCarousel]);
  const activeGroups = useMemo(() => groups.filter((group) => group.carousel === activeCarousel), [groups, activeCarousel]);
  const report = useMemo(
    () => resolvedOnce && campaign ? validateCampaign({ offers: activeOffers, groups: activeGroups, assets }) : null,
    [resolvedOnce, campaign, activeOffers, activeGroups, assets],
  );

  async function handleFile(file: File) {
    setError(null);
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Selecione um arquivo XLSX ou XLS.");
      const parsed = parseCampaignWorkbook(await file.arrayBuffer(), file.name);
      if (!parsed.offers.length) throw new Error("Nenhuma oferta válida foi encontrada.");
      setCampaign(parsed);
      setSourceName(file.name);
      setActiveCarousel(parsed.carousels[0] ?? "");
      setFolders(Object.fromEntries(parsed.carousels.map((carousel) => [carousel, suggestFolder(parsed.campaignCode, carousel)])));
      setAssets(EMPTY_ASSETS);
      setManualInputs({});
      setManualOverrides({});
      setManualMessage("");
      setResolutionMessages([]);
      setResolvedOnce(false);
    } catch (e) {
      setCampaign(null);
      setError(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    }
  }

  async function resolveAssets() {
    if (!campaign) return;
    setResolving(true);
    setError(null);
    const next: AssetCatalog = { destinations: {}, airlines: {}, destinationErrors: {}, airlineErrors: {} };
    const diagnostics: string[] = [];

    try {
      for (const carousel of campaign.carousels) {
        const iatas = Array.from(new Set(campaign.offers.filter((offer) => offer.carousel === carousel).map((offer) => offer.destination.iata)));
        const result = await resolveFolder(folders[carousel], "destination", iatas, environment);
        if (!result.ok) {
          diagnostics.push(`${carousel}: ${result.message} (${result.code}).`);
          for (const iata of iatas) next.destinationErrors![`${normalizeKey(carousel)}:${iata}`] = "missing";
          continue;
        }
        if (result.documentCount === 0) {
          diagnostics.push(`${carousel}: pasta encontrada, mas nenhum documento acessível via API.`);
        }
        for (const iata of iatas) {
          const resolution = result.resolutions[iata];
          const key = `${normalizeKey(carousel)}:${iata}`;
          if (resolution?.status === "resolved") next.destinations[key] = resolution.url;
          else next.destinationErrors![key] = resolution?.status === "ambiguous" ? "ambiguous" : "missing";
        }
      }

      const airlineResult = await resolveFolder(airlineFolder, "airline", campaign.airlines, environment);
      if (!airlineResult.ok) {
        diagnostics.push(`Logos: ${airlineResult.message} (${airlineResult.code}).`);
        for (const airline of campaign.airlines) next.airlineErrors![normalizeKey(airline)] = "missing";
      } else {
        for (const airline of campaign.airlines) {
          const resolution = airlineResult.resolutions[airline];
          const key = normalizeKey(airline);
          if (resolution?.status === "resolved") next.airlines[key] = resolution.url;
          else next.airlineErrors![key] = resolution?.status === "ambiguous" ? "ambiguous" : "missing";
        }
      }

      // Pasted document URLs take precedence over inaccessible Headless API results.
      for (const [key, url] of Object.entries(manualOverrides)) {
        next.destinations[key] = url;
        delete next.destinationErrors?.[key];
      }
      setResolutionMessages(diagnostics);
      setAssets(next);
      setResolvedOnce(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao consultar o Liferay.");
    } finally {
      setResolving(false);
    }
  }

  function applyManualUrls() {
    const expectedIatas = Array.from(new Set(activeOffers.map((offer) => offer.destination.iata)));
    const { urls, errors } = parseDestinationUrls(manualInputs[activeCarousel] ?? "", expectedIatas, environment);
    const assignments = Object.fromEntries(
      Object.entries(urls).map(([iata, url]) => [`${normalizeKey(activeCarousel)}:${iata}`, url]),
    );
    const count = Object.keys(assignments).length;

    if (errors.length > 0) {
      setManualMessage(`Não foi possível associar as imagens: ${errors.join(" ")} Corrija as URLs e tente novamente.`);
      return;
    }

    if (count > 0) {
      setManualOverrides((current) => ({ ...current, ...assignments }));
      setAssets((current) => {
        const destinationErrors = { ...(current.destinationErrors ?? {}) };
        for (const key of Object.keys(assignments)) delete destinationErrors[key];
        return {
          ...current,
          destinations: { ...current.destinations, ...assignments },
          destinationErrors,
        };
      });
      setResolvedOnce(true);
    }
    setManualMessage([
      count > 0 ? `${count} imagem(ns) associada(s) a este carrossel.` : "Nenhuma imagem associada.",
      ...errors,
    ].join(" "));
  }

  function exportJson() {
    if (!campaign || !report?.canExport) return;
    const output = activeOffers.map((offer) => mapOfferToExport(offer, {
      destinationImageUrl: assets.destinations[destinationAssetKey(offer)],
      airlineLogoUrl: assets.airlines[airlineAssetKey(offer)],
    }));
    const validated = exportOfferSchema.array().parse(output);
    downloadJson(exportFileName(campaign, activeCarousel), validated);
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Campanhas aéreas</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">JSON Gen</h1>
            <p className="mt-1 text-sm text-muted-foreground">Planilha → agrupamento → assets → preflight → JSON.</p>
          </div>
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">v1 local</span>
        </header>

        {!campaign ? (
          <section className="workspace-shell p-6">
            <label
              className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border bg-background"}`}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
              onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = Array.from(event.dataTransfer.files).find((item) => /\.(xlsx|xls)$/i.test(item.name));
                if (file) void handleFile(file);
                else setError("Solte um arquivo XLSX ou XLS válido.");
              }}
            >
              <strong className="text-lg">{dragging ? "Solte para importar a planilha" : "Solte sua planilha aqui"}</strong>
              <span className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Selecione o XLSX da campanha. O arquivo é processado localmente no navegador.</span>
              <span className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Selecionar XLSX</span>
              <input className="sr-only" type="file" accept=".xlsx,.xls" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.currentTarget.value = "";
              }} />
            </label>
            {error ? <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
          </section>
        ) : (
          <section className="workspace-shell p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{sourceName}</p>
                <h2 className="mt-1 text-xl font-semibold">{campaign.campaignCode ?? "Campanha"}</h2>
              </div>
              {summary ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
                  <span><b>{summary.offerCount}</b> ofertas</span>
                  <span><b>{summary.carouselCount}</b> carrosséis</span>
                  <span><b>{summary.dropdownCount}</b> dropdowns</span>
                  <span><b>{summary.standaloneCount}</b> soltas</span>
                  <span><b>{summary.airlineCount}</b> cias</span>
                </div>
              ) : null}
            </div>

            <div className="border-b border-border py-5">
              <label className="grid max-w-md gap-2">
                <span className="text-sm font-semibold">Ambiente dos documentos Liferay</span>
                <select
                  aria-label="Ambiente do Liferay"
                  disabled={resolving}
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={environment}
                  onChange={(event) => {
                    setEnvironment(event.target.value as LiferayEnvironment);
                    setAssets(EMPTY_ASSETS);
                    setManualOverrides({});
                    setManualInputs({});
                    setResolutionMessages([]);
                    setManualMessage("");
                    setResolvedOnce(false);
                  }}
                >
                  <option value="production">Produção (www.smiles.com.br)</option>
                  <option value="staging-green">Staging Green</option>
                  <option value="staging-blue">Staging Blue</option>
                </select>
                <span className="text-xs leading-5 text-muted-foreground">
                  O JSON usa a URL real retornada pelo Liferay. Publicar uma imagem no staging não garante que ela exista em produção.
                  Para gerar URLs de produção, selecione Produção; selecione Green ou Blue para homologar.
                </span>
              </label>
            </div>

            <div className="grid gap-6 border-b border-border py-6 lg:grid-cols-[1.2fr_.8fr]">
              <div>
                <h3 className="text-sm font-semibold">Pastas de imagens</h3>
                <div className="mt-3 grid gap-3">
                  {campaign.carousels.map((carousel) => (
                    <label key={carousel} className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{carousel}</span>
                      <input className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={folders[carousel] ?? ""} onChange={(e) => {
                        setFolders((current) => ({ ...current, [carousel]: e.target.value }));
                        setResolvedOnce(false);
                      }} />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Logos das companhias</h3>
                <label className="mt-3 grid gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Pasta compartilhada</span>
                  <input className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={airlineFolder} onChange={(e) => {
                    setAirlineFolder(e.target.value);
                    setResolvedOnce(false);
                  }} />
                </label>
                <button className="mt-4 h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={resolving} onClick={() => void resolveAssets()}>
                  {resolving ? "Consultando Liferay…" : "Resolver assets"}
                </button>
                {resolutionMessages.length > 0 ? (
                  <div role="status" className="mt-3 grid gap-1 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs leading-5 text-muted-foreground">
                    <strong className="text-foreground">Diagnóstico da consulta</strong>
                    {resolutionMessages.map((message, index) => <p key={index}>{message}</p>)}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-b border-border py-6">
              <div className="flex flex-wrap gap-2">
                {campaign.carousels.map((carousel) => (
                  <button key={carousel} onClick={() => setActiveCarousel(carousel)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${carousel === activeCarousel ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}>
                    Carrossel {extractCarouselNumber(carousel) ?? campaign.carousels.indexOf(carousel) + 1}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{activeCarousel}</p>
            </div>

            <div className="border-b border-border py-5">
              <h3 className="text-sm font-semibold">Associar imagens por URL</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Se a API do Liferay não encontrar as imagens, cole aqui os links diretos dos documentos do carrossel selecionado, um por linha.
                O IATA será identificado pelo início do nome do arquivo (ex.: scl_750x500_1). Nenhuma URL é inventada.
              </p>
              <textarea
                aria-label="URLs das imagens do carrossel"
                className="mt-3 min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                placeholder={environment === "production" ? "https://www.smiles.com.br/documents/d/guest/scl_750x500_1-68" : "Cole a URL real do documento no ambiente escolhido"}
                value={manualInputs[activeCarousel] ?? ""}
                onChange={(event) => { setManualInputs((current) => ({ ...current, [activeCarousel]: event.target.value })); setManualMessage(""); }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button className="h-9 rounded-xl border border-primary/30 bg-primary/10 px-4 text-xs font-semibold text-primary" onClick={applyManualUrls}>
                  Associar URLs ao carrossel
                </button>
                <span className="text-xs text-muted-foreground">{Array.from(new Set(activeOffers.map((offer) => offer.destination.iata))).filter((iata) => assets.destinations[`${normalizeKey(activeCarousel)}:${iata}`]).length} de {new Set(activeOffers.map((offer) => offer.destination.iata)).size} destinos com imagem</span>
              </div>
              {manualMessage ? <p role="status" className="mt-2 text-xs leading-5 text-muted-foreground">{manualMessage}</p> : null}
            </div>

            <div className="grid gap-6 py-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Agrupamentos</h3>
                <div className="mt-3 grid max-h-[28rem] gap-2 overflow-auto pr-1">
                  {activeGroups.map((group) => (
                    <div key={group.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm">{group.kind === "dropdown" ? `${group.label} · ${group.destinationIata}` : group.label}</strong>
                        <span className="text-xs text-muted-foreground">{group.kind === "dropdown" ? "Dropdown" : "Solta"} · {group.offers.length}</span>
                      </div>
                      {group.kind === "dropdown" ? <div className="mt-2 text-xs leading-5 text-muted-foreground">{group.offers.map((offer) => `${offer.origin.iata} → ${offer.destination.iata}`).join(" · ")}</div> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Preflight</h3>
                {!resolvedOnce ? (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Resolva os assets para validar o carrossel.</div>
                ) : report ? (
                  <div className="mt-3 grid gap-3">
                    <div className={`rounded-xl border p-4 ${report.canExport ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>
                      <strong className="text-sm">{report.canExport ? "Pronto para exportar" : `${report.errors.length} erro(s) bloqueante(s)`}</strong>
                    </div>
                    {report.issues.slice(0, 8).map((issue, index) => (
                      <p key={`${issue.code}:${index}`} className="text-sm leading-5 text-muted-foreground">{issue.message}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <p className="font-mono text-xs text-muted-foreground">{exportFileName(campaign, activeCarousel)}</p>
              <button className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-35" disabled={!report?.canExport} onClick={exportJson}>Gerar JSON</button>
            </div>

            {error ? <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
          </section>
        )}
      </div>
    </main>
  );
}
