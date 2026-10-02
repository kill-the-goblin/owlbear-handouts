import OBR, { type ImageAssetType } from "@owlbear-rodeo/sdk";

const CATEGORY_LABELS: Record<ImageAssetType, string> = {
  MAP: "Maps",
  PROP: "Props",
  MOUNT: "Mounts",
  CHARACTER: "Characters",
  ATTACHMENT: "Attachments",
  NOTE: "Notes",
};

export function assetCategoryLabel(category: ImageAssetType): string {
  return CATEGORY_LABELS[category];
}

export function assetLabel(name: string, category?: ImageAssetType): string {
  return category ? `${assetCategoryLabel(category)} / ${name}` : name;
}

export async function chooseAsset(): Promise<{ url: string; name: string; category: ImageAssetType } | undefined> {
  const [asset] = await OBR.assets.downloadImages(false);
  const url = asset?.image.url?.trim();
  if (!url) return undefined;
  return { url, name: asset.name?.trim() || "Owlbear asset", category: asset.type };
}
