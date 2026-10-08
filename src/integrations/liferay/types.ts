export type LiferayFolder = {
  id: number | string;
  name: string;
};

export type LiferayDocument = {
  id: number | string;
  title: string;
  contentUrl: string;
  fileExtension?: string;
};

export type AssetResolution =
  | { status: "resolved"; url: string; documentId: number | string; title: string }
  | { status: "missing"; candidates: string[] }
  | { status: "ambiguous"; candidates: Array<{ id: number | string; title: string; url: string }> };
