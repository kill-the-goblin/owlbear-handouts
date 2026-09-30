export const EXTENSION_ID = "com.nealenssle.owlbear-modals";

export const METADATA_KEY = `${EXTENSION_ID}/link`;

export const CONTEXT_MENU_CONFIGURE_ID = `${EXTENSION_ID}/configure`;

export const BROADCAST_SHOW_CHANNEL = `${EXTENSION_ID}/modal-show`;
export const BROADCAST_HIDE_CHANNEL = `${EXTENSION_ID}/modal-hide`;

export const VIEWER_MODAL_ID = `${EXTENSION_ID}/viewer-modal`;
export const PREVIEW_POPOVER_ID = `${EXTENSION_ID}/preview-popover`;
export const PREVIEW_SIZE_KEY = `${EXTENSION_ID}/preview-size`;

export interface PreviewSize {
  width: number;
  height: number;
}

export const DEFAULT_PREVIEW_SIZE: PreviewSize = { width: 400, height: 300 };
export const MIN_PREVIEW_HEIGHT = 200;
export const MAX_PREVIEW_HEIGHT = 600;

export function readPreviewSize(value: unknown): PreviewSize {
  if (!value || typeof value !== "object") return DEFAULT_PREVIEW_SIZE;
  const size = value as Partial<PreviewSize>;
  if (
    typeof size.height !== "number" || !Number.isInteger(size.height) ||
    size.height < MIN_PREVIEW_HEIGHT || size.height > MAX_PREVIEW_HEIGHT
  ) return DEFAULT_PREVIEW_SIZE;
  return { width: Math.round(size.height * 4 / 3), height: size.height };
}

export type ModalContentType = "image" | "page";

export const MAX_HANDOUT_LINKS = 3;

export interface HandoutLink {
  type: ModalContentType;
  url: string;
}

export interface HandoutLinks {
  links: HandoutLink[];
  linkCount: number;
}

export function createHandoutMetadata(links: HandoutLink[]): HandoutLinks {
  return { links, linkCount: links.length };
}

// Older tokens stored one imageUrl and one pageUrl. Read both shapes so their
// links remain available until the next edit writes the new format.
export function readHandoutLinks(value: unknown): HandoutLink[] {
  if (!value || typeof value !== "object") return [];
  const data = value as { links?: unknown; imageUrl?: unknown; pageUrl?: unknown };
  if (Array.isArray(data.links)) {
    return data.links
      .filter((link): link is HandoutLink =>
        link !== null && typeof link === "object" &&
        (link.type === "image" || link.type === "page") &&
        typeof link.url === "string" && link.url.trim().length > 0,
      )
      .slice(0, MAX_HANDOUT_LINKS)
      .map((link) => ({ type: link.type, url: link.url.trim() }));
  }
  const links: HandoutLink[] = [];
  if (typeof data.imageUrl === "string" && data.imageUrl.trim()) {
    links.push({ type: "image", url: data.imageUrl.trim() });
  }
  if (typeof data.pageUrl === "string" && data.pageUrl.trim()) {
    links.push({ type: "page", url: data.pageUrl.trim() });
  }
  return links;
}

export interface ModalShowMessage {
  id: string;
  url: string;
  contentType: ModalContentType;
  tokenName: string;
}
