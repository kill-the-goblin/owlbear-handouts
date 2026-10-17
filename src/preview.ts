import OBR from "@owlbear-rodeo/sdk";
import { ACTIVE_PRESENTATION_KEY, isImageLink, readActivePresentation } from "./constants";
import { dismissHandout } from "./presentation";
import { renderHandoutText } from "./text";

const params = new URLSearchParams(window.location.search);
const id = params.get("id") ?? "";
const url = params.get("url") ?? "";
const contentType = params.get("contentType");
const handoutName = params.get("handoutName")?.trim() || "Handout";
const assetName = params.get("assetName")?.trim();
const content = document.querySelector<HTMLDivElement>("#content")!;
const urlLabel = document.querySelector<HTMLDivElement>("#url")!;
const title = document.querySelector<HTMLSpanElement>("#title")!;
const dismiss = document.querySelector<HTMLButtonElement>("#dismiss")!;

const typeLabel = document.createElement("strong");
typeLabel.textContent = contentType === "asset" ? "Asset" : contentType === "text" ? "Text" : "Link";
title.replaceChildren(typeLabel, `: ${handoutName}`);
title.title = `${typeLabel.textContent}: ${handoutName}`;
urlLabel.textContent = contentType === "text" ? "" : contentType === "asset" ? assetName || "Owlbear asset" : url;
urlLabel.title = url;
urlLabel.hidden = contentType === "text";

if (contentType === "text") {
  // The presentation text lives in room metadata, not in the preview URL.
} else if (contentType === "asset" || isImageLink(url)) {
  const image = document.createElement("img");
  image.src = url;
  image.alt = "Handout preview";
  content.appendChild(image);
} else {
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.title = "Handout preview";
  content.appendChild(frame);
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") return;
  if (contentType === "text") {
    const metadata = await OBR.room.getMetadata();
    const active = readActivePresentation(metadata[ACTIVE_PRESENTATION_KEY]);
    if (active?.id === id && active.contentType === "text") {
      renderHandoutText(content, active.text ?? "", active.textTheme);
    }
  }
  dismiss.addEventListener("click", async () => {
    dismiss.disabled = true;
    try {
      await dismissHandout(id);
    } catch {
      dismiss.disabled = false;
    }
  });
});
