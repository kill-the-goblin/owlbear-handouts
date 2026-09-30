import OBR from "@owlbear-rodeo/sdk";
import { VIEWER_MODAL_ID, ModalContentType } from "./constants";

const params = new URLSearchParams(window.location.search);
const url = params.get("url") ?? "";
const contentType = params.get("contentType") as ModalContentType | null;
const isPrivate = params.get("mode") === "private";

const container = document.querySelector<HTMLDivElement>("#content")!;
const closeButton = document.querySelector<HTMLButtonElement>("#close-button")!;

function showError(message: string) {
  container.replaceChildren();
  const errorEl = document.createElement("div");
  errorEl.id = "error-message";
  errorEl.textContent = message;
  container.appendChild(errorEl);
}

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  const isGm = role === "GM";

  if (contentType === "image") {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.addEventListener("error", () => {
      // Only the GM sees the diagnostic text; a player just sees nothing.
      if (isGm) {
        showError(
          `Couldn't load this image. Check that the URL is correct, publicly reachable, and points directly at an image file.\n\n${url}`,
        );
      } else {
        container.replaceChildren();
      }
    });
    container.appendChild(img);
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    container.appendChild(iframe);

    // Iframe load failures (e.g. a site's X-Frame-Options blocking embedding)
    // are not detectable from JavaScript for cross-origin content -- browsers
    // deliberately hide that from the embedding page. This is a static hint,
    // not a real failure check, and only shown to the GM.
    if (isGm) {
      const note = document.createElement("div");
      note.id = "iframe-note";
      note.textContent =
        "If this looks blank, the site may be blocking embedding (common on many pages) -- try Image mode with a direct file URL instead.";
      document.body.appendChild(note);
    }
  }

  if (!isGm || !isPrivate) {
    return;
  }

  closeButton.hidden = false;
  closeButton.addEventListener("click", () => OBR.modal.close(VIEWER_MODAL_ID));

  if (contentType === "image") {
    container.classList.add("dismissable");
    container.addEventListener("click", () => OBR.modal.close(VIEWER_MODAL_ID));
  }
});
