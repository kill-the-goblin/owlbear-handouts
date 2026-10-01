import OBR from "@owlbear-rodeo/sdk";
import { isImageLink } from "./constants";
import { dismissHandout } from "./presentation";

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
typeLabel.textContent = contentType === "asset" ? "Asset" : "Link";
title.replaceChildren(typeLabel, `: ${handoutName}`);
title.title = `${typeLabel.textContent}: ${handoutName}`;
urlLabel.textContent = contentType === "asset" ? assetName || "Owlbear asset" : url;
urlLabel.title = url;

if (contentType === "asset" || isImageLink(url)) {
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
  dismiss.addEventListener("click", async () => {
    dismiss.disabled = true;
    try {
      await dismissHandout(id);
    } catch {
      dismiss.disabled = false;
    }
  });
});
