# JSON Gen v1 — Design

Date: 2026-10-07

## Goal

Build a fast, local-first tool that replaces the current airfare-campaign JSON generator.

The v1 must prioritize correctness over automation magic: parse the campaign source deterministically, group dropdown offers correctly, resolve Liferay assets by destination IATA / airline, validate the result, and only allow export when blocking errors are resolved.

## Scope

### In scope

- Run locally with `npm install` + `npm run dev`.
- No authentication, database, analytics, or user accounts.
- Accept `.xlsx` campaign uploads.
- Detect campaign rows, carousels, standalone offers, and dropdown groups.
- Preserve standalone offers with `dropdown: "SOLTA"`.
- Group dropdowns by carousel + normalized dropdown identifier.
- Never group all `SOLTA` rows together.
- Preserve duplicate routes when date/price differ; flag them as warnings instead of deleting them.
- Generate stable offer IDs from origin, destination and departure date.
- Configure one Liferay image folder per detected carousel.
- Configure one Liferay airline-logo folder.
- Resolve destination image using destination IATA, e.g. `MIA_*`.
- Use the actual public document URL returned by Liferay; never synthesize suffixes such as `-13`.
- Resolve airline logos through normalized aliases.
- Preflight validation before export.
- Preview grouped data.
- Export JSON compatible with the supplied valid production example.

### Out of scope for v1

- Authentication.
- Cloud deployment.
- Persistent campaign history.
- Database.
- Collaborative editing.
- Automated publishing to Liferay.
- AI-based data correction.

## Primary workflow

1. User opens the local app.
2. User drops an XLSX file.
3. App parses and normalizes campaign data.
4. App displays campaign summary:
   - total offers
   - detected carousels
   - dropdown groups
   - standalone offers
   - airlines
5. App creates one Liferay folder input for each detected carousel and one input for airline logos.
6. User enters folder names.
7. App queries Liferay and resolves destination images / airline logos.
8. App shows grouping preview and validation results.
9. Blocking errors prevent export; warnings do not.
10. User downloads the final JSON.

## Data pipeline

```
XLSX
  -> spreadsheet parser
  -> normalized campaign model
  -> grouping engine
  -> asset resolver
  -> validation engine
  -> export mapper
  -> JSON
```

The spreadsheet parser must never write final JSON directly.

## Normalized model

```ts
type NormalizedOffer = {
  sourceRow: number;
  carousel: string;
  origin: {
    label: string;
    iata: string;
  };
  destination: {
    label: string;
    iata: string;
  };
  airline: string;
  connection: string | null;
  dropdown:
    | { type: "single" }
    | { type: "group"; key: string; raw: string };
  departureDate: string;
  pricing: {
    original: string | null;
    clubDiscount: string | null;
    club: string | null;
    smilesDiscount: string | null;
    smiles: string | null;
    customer12x: string | null;
    customerSmilesAndMoney: string | null;
    customerTotal: string | null;
    club12x: string | null;
    clubSmilesAndMoney: string | null;
    clubTotal: string | null;
  };
  links: {
    flight: string;
    hotel: string | null;
  };
};
```

## Dropdown rules

- `SOLTA` is always a standalone offer.
- A dropdown group key is `carousel + normalized dropdown value`.
- A group must not span multiple carousels.
- Group members should normally share the same destination IATA.
- If one member has a mismatched destination IATA, raise a blocking validation error.
- Repeated origin/destination pairs are not automatically duplicates.
- Same route with different date and/or price is preserved and surfaced as a warning.

## Export contract

The final object must preserve the existing production field names, including:

- `id`
- `categoria_destino`
- `Origem`
- `iata_origem`
- `Destino`
- `iata_destino`
- `Cia`
- `conexao`
- `dropdown`
- `valor_original`
- `clube_desconto`
- `Clube`
- `smiles_desconto`
- `Smiles`
- `data_saida`
- customer / club installment and Smiles & Money fields
- `Links`
- `link_hotel`
- `link_img_desk`
- `link_img_mobile`
- `link_img_cia_aerea`

Null vs empty-string behavior must match the supplied valid JSON fixture where the source semantics are known.

## Liferay asset resolution

### Destination images

For each offer:

1. Determine its carousel.
2. Use the configured folder for that carousel.
3. Search folder documents.
4. Match a document whose normalized title/file name begins with `<IATA>_`.
5. Store the public URL returned by Liferay.
6. Use the same image for desktop and mobile in v1 unless the source exposes distinct variants.

If no unique match exists, raise a blocking error.

### Airline logos

- Normalize airline names through a versioned alias map.
- Resolve one logo per normalized airline.
- Do not guess public URLs.

## Validation

### Blocking errors

- Spreadsheet structure cannot be recognized.
- Missing origin/destination IATA.
- Invalid or missing departure date.
- Missing flight link where required.
- Duplicate generated IDs.
- Dropdown group spans destinations unexpectedly.
- Required image cannot be resolved uniquely.
- Airline logo cannot be resolved uniquely.
- Export schema fails validation.

### Warnings

- Same origin/destination route occurs more than once with different date/price.
- Optional pricing fields are empty.
- Hotel link is empty.
- Unrecognized optional columns.

## UX

Single-page operational workspace, not a multi-step wizard.

Sections:

1. Source upload.
2. Campaign summary.
3. Asset folders.
4. Grouping preview.
5. Validation / preflight.
6. Export.

The UI should be premium but restrained:
- neutral background
- strong typography
- compact spacing
- clear status hierarchy
- subtle motion for state changes only
- no decorative dashboard clutter

The user should always be able to answer:
- What did the tool understand?
- What did it find?
- Is it safe to generate?

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zod
- SheetJS/xlsx
- Vitest for parser/grouping/export tests

## Test fixtures

Use the supplied real artifacts as regression fixtures:

- `AER1525_destinos_v1.xlsx` — current campaign input.
- `AER1522_OFFERS01_V3.json` — known-good production-style output.

Tests must cover:
- standalone offers are not grouped together
- dropdown groups are grouped by carousel + dropdown key
- duplicate route variants are preserved
- generated IDs are unique
- export fields match the expected contract
- invalid groups fail preflight
- missing assets block export

## v1 success criteria

The v1 is ready to use when:

1. The AER1525 spreadsheet parses without manual row edits.
2. Carousels and dropdowns are grouped correctly.
3. Asset folders can be configured per carousel.
4. Images and airline logos resolve from Liferay or clearly report missing matches.
5. The final JSON matches the known production contract.
6. Export is blocked whenever a correctness-critical validation fails.
7. The core flow works locally from upload to downloaded JSON.
