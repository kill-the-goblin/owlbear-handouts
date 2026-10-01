import OBR from "@owlbear-rodeo/sdk";
import { BROADCAST_HIDE_CHANNEL } from "./constants";

const params = new URLSearchParams(window.location.search);
const id = params.get("id") ?? "";
const url = params.get("url") ?? "";
const contentType = params.get("contentType");
const tokenName = params.get("tokenName")?.trim() || "Token";
const assetName = params.get("assetName")?.trim();
const content = document.querySelector<HTMLDivElement>("#content")!;
const urlLabel = document.querySelector<HTMLDivElement>("#url")!;
const title = document.querySelector<HTMLSpanElement>("#title")!;
const dismiss = document.querySelector<HTMLButtonElement>("#dismiss")!;

const typeLabel = document.createElement("strong");
typeLabel.textContent = contentType === "asset" ? "Asset" : contentType === "image" ? "Image" : "Page";
title.replaceChildren(typeLabel, `: ${tokenName}`);
title.title = `${typeLabel.textContent}: ${tokenName}`;
urlLabel.textContent = contentType === "asset" ? assetName || "Owlbear asset" : url;
urlLabel.title = url;

if (contentType === "image" || contentType === "asset") {
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
      await OBR.broadcast.sendMessage(BROADCAST_HIDE_CHANNEL, id, { destination: "ALL" });
    } catch {
      dismiss.disabled = false;
    }
  });
});
