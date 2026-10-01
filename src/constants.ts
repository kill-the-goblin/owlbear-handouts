export const EXTENSION_ID = "com.nealenssle.owlbear-modals";

export const METADATA_KEY = `${EXTENSION_ID}/link`;

export const CONTEXT_MENU_CONFIGURE_ID = `${EXTENSION_ID}/configure`;

export const ACTIVE_PRESENTATION_KEY = `${EXTENSION_ID}/active-presentation`;

export const VIEWER_MODAL_ID = `${EXTENSION_ID}/viewer-modal`;
export const PREVIEW_POPOVER_ID = `${EXTENSION_ID}/preview-popover`;
export const PREVIEW_SIZE_KEY = `${EXTENSION_ID}/preview-size`;
export const PREVIEW_LOCATION_KEY = `${EXTENSION_ID}/preview-location`;

export interface PreviewSize {
  width: number;
  height: number;
}

export const DEFAULT_PREVIEW_SIZE: PreviewSize = { width: 400, height: 300 };
export const MIN_PREVIEW_HEIGHT = 200;
export const MAX_PREVIEW_HEIGHT = 450;

export type PreviewLocation = "bottom-left" | "bottom-right" | "top-left" | "top-right";
export const DEFAULT_PREVIEW_LOCATION: PreviewLocation = "bottom-left";

export function readPreviewLocation(value: unknown): PreviewLocation {
  return value === "bottom-right" || value === "top-left" || value === "top-right"
    ? value
    : DEFAULT_PREVIEW_LOCATION;
}

export function readPreviewSize(value: unknown): PreviewSize {
  if (!value || typeof value !== "object") return DEFAULT_PREVIEW_SIZE;
  const size = value as Partial<PreviewSize>;
  if (typeof size.height !== "number" || !Number.isFinite(size.height)) return DEFAULT_PREVIEW_SIZE;
  const height = Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, Math.round(size.height)));
  return { width: Math.round(height * 4 / 3), height };
}

export type ModalContentType = "asset" | "link";

export function isImageLink(url: string): boolean {
  try {
    return /\.(?:apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export const MAX_HANDOUT_LINKS = 3;

export interface HandoutLink {
  type: ModalContentType;
  url: string;
  name?: string;
}

export interface HandoutLinks {
  links: HandoutLink[];
  linkCount: number;
}

export function createHandoutMetadata(links: HandoutLink[]): HandoutLinks {
  return { links, linkCount: links.length };
}

// Treat earlier Image and Page entries as links; the URL now determines rendering.
export function readHandoutLinks(value: unknown): HandoutLink[] {
  if (!value || typeof value !== "object") return [];
  const data = value as { links?: unknown; imageUrl?: unknown; pageUrl?: unknown };
  if (Array.isArray(data.links)) {
    return data.links
      .filter((link): link is HandoutLink =>
        link !== null && typeof link === "object" &&
        (link.type === "asset" || link.type === "link" || link.type === "image" || link.type === "page") &&
        typeof link.url === "string" && link.url.trim().length > 0,
      )
      .slice(0, MAX_HANDOUT_LINKS)
      .map((link) => ({
        type: link.type === "asset" ? "asset" : "link",
        url: link.url.trim(),
        ...(link.type === "asset" && typeof link.name === "string" && link.name.trim()
          ? { name: link.name.trim() }
          : {}),
      }));
  }
  const links: HandoutLink[] = [];
  if (typeof data.imageUrl === "string" && data.imageUrl.trim()) {
    links.push({ type: "link", url: data.imageUrl.trim() });
  }
  if (typeof data.pageUrl === "string" && data.pageUrl.trim()) {
    links.push({ type: "link", url: data.pageUrl.trim() });
  }
  return links;
}

export interface ModalShowMessage {
  id: string;
  url: string;
  contentType: ModalContentType;
  tokenName: string;
  assetName?: string;
}

export interface ActivePresentation extends ModalShowMessage {
  presenterConnectionId: string;
}

export function readActivePresentation(value: unknown): ActivePresentation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Partial<ActivePresentation>;
  if (
    typeof data.id !== "string" || !data.id ||
    typeof data.url !== "string" || !data.url.trim() ||
    (data.contentType !== "asset" && data.contentType !== "link") ||
    typeof data.presenterConnectionId !== "string" || !data.presenterConnectionId
  ) return undefined;
  return {
    id: data.id,
    url: data.url,
    contentType: data.contentType,
    tokenName: typeof data.tokenName === "string" ? data.tokenName : "Token",
    presenterConnectionId: data.presenterConnectionId,
    ...(typeof data.assetName === "string" ? { assetName: data.assetName } : {}),
  };
}
