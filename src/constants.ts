import type { ImageAssetType } from "@owlbear-rodeo/sdk";

export const EXTENSION_ID = "com.nealenssle.owlbear-modals";

export const METADATA_KEY = `${EXTENSION_ID}/link`;
export const SCENE_HANDOUTS_KEY = `${EXTENSION_ID}/scene-handouts`;

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

export interface SceneHandout extends HandoutLink {
  id: string;
  title: string;
  assetCategory?: ImageAssetType;
  inactiveUrl?: string;
  inactiveName?: string;
}

const ASSET_CATEGORIES = ["MAP", "PROP", "MOUNT", "CHARACTER", "ATTACHMENT", "NOTE"];

function isAssetCategory(value: unknown): value is ImageAssetType {
  return typeof value === "string" && ASSET_CATEGORIES.includes(value);
}

export function reorderHandouts(list: SceneHandout[], ids: string[]): SceneHandout[] {
  const byId = new Map(list.map((entry) => [entry.id, entry]));
  const ordered: SceneHandout[] = [];
  for (const id of ids) {
    const entry = byId.get(id);
    if (entry) {
      ordered.push(entry);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}

export function moveHandout(list: SceneHandout[], id: string, direction: -1 | 1): SceneHandout[] {
  const index = list.findIndex((entry) => entry.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function switchHandoutType(handout: SceneHandout, type: ModalContentType): SceneHandout {
  if (handout.type === type) return handout;
  return {
    id: handout.id,
    title: handout.title,
    type,
    url: handout.inactiveUrl ?? "",
    inactiveUrl: handout.url,
    ...(handout.assetCategory ? { assetCategory: handout.assetCategory } : {}),
    ...(type === "asset" && handout.inactiveName ? { name: handout.inactiveName } : {}),
    ...(handout.type === "asset" && handout.name ? { inactiveName: handout.name } : {}),
  };
}

export function readSceneHandouts(value: unknown): SceneHandout[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is SceneHandout =>
    entry !== null && typeof entry === "object" &&
    typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.title === "string" &&
    (entry.type === "asset" || entry.type === "link") &&
    typeof entry.url === "string",
  ).map((entry) => ({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    url: entry.url,
    ...(isAssetCategory(entry.assetCategory) ? { assetCategory: entry.assetCategory } : {}),
    ...(typeof entry.name === "string" ? { name: entry.name } : {}),
    ...(typeof entry.inactiveUrl === "string" ? { inactiveUrl: entry.inactiveUrl } : {}),
    ...(typeof entry.inactiveName === "string" ? { inactiveName: entry.inactiveName } : {}),
  }));
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
  handoutName: string;
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
    handoutName: typeof data.handoutName === "string" ? data.handoutName : "Handout",
    presenterConnectionId: data.presenterConnectionId,
    ...(typeof data.assetName === "string" ? { assetName: data.assetName } : {}),
  };
}
