import OBR from "@owlbear-rodeo/sdk";

export async function chooseAsset(): Promise<{ url: string; name: string } | undefined> {
  const [asset] = await OBR.assets.downloadImages(false);
  const url = asset?.image.url?.trim();
  if (!url) return undefined;
  return { url, name: asset.name?.trim() || "Owlbear asset" };
}
