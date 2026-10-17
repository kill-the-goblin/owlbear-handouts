import OBR from "@owlbear-rodeo/sdk";
import { ACTIVE_PRESENTATION_KEY, SCENE_HANDOUTS_KEY, VIEWER_MODAL_ID, ModalContentType, isImageLink, readActivePresentation, readSceneHandouts } from "./constants";
import { renderHandoutText } from "./text";

const params = new URLSearchParams(window.location.search);
const initialUrl = params.get("url") ?? "";
const initialContentType = params.get("contentType") as ModalContentType | null;
const isPrivate = params.get("mode") === "private";
let shownId = initialContentType === "text" ? null : params.get("id");

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

  function showContent(url: string, contentType: ModalContentType | null, text = "", textTheme: "dark" | "light" = "dark") {
    // Clear the old handout first. The viewer's black background stays visible
    // until the next image or page has loaded.
    container.replaceChildren();
    container.classList.remove("text-mode", "light-text");
    document.querySelector("#iframe-note")?.remove();

    if (contentType === "text") {
      renderHandoutText(container, text, textTheme);
    } else if (contentType === "asset" || isImageLink(url)) {
      const img = document.createElement("img");
      img.hidden = true;
      img.alt = "";
      img.addEventListener("load", () => { img.hidden = false; });
      img.addEventListener("error", () => {
        if (!container.contains(img)) return;
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
      img.src = url;
    } else {
      const iframe = document.createElement("iframe");
      iframe.hidden = true;
      iframe.addEventListener("load", () => { iframe.hidden = false; });
      container.appendChild(iframe);
      iframe.src = url;

      // Cross-origin iframe failures cannot be detected from JavaScript.
      if (isGm) {
        const note = document.createElement("div");
        note.id = "iframe-note";
        note.textContent =
          "If this looks blank, the site may be blocking embedding. Try a direct image-file URL instead.";
        document.body.appendChild(note);
      }
    }
  }

  if (initialContentType === "text") {
    if (isPrivate) {
      const handoutId = params.get("handoutId");
      const metadata = await OBR.scene.getMetadata();
      const handout = readSceneHandouts(metadata[SCENE_HANDOUTS_KEY]).find((entry) => entry.id === handoutId);
      if (handout?.type === "text") showContent("", "text", handout.text, handout.textTheme);
      else showError("This text handout is no longer available.");
    }
  } else {
    showContent(initialUrl, initialContentType);
  }

  if (!isPrivate) {
    let receivedMetadataChange = false;
    const update = (metadata: Record<string, unknown>) => {
      const active = readActivePresentation(metadata[ACTIVE_PRESENTATION_KEY]);
      if (!active || active.id === shownId) return;
      shownId = active.id;
      showContent(active.url, active.contentType, active.text, active.textTheme);
    };
    OBR.room.onMetadataChange((metadata) => {
      receivedMetadataChange = true;
      update(metadata);
    });
    const metadata = await OBR.room.getMetadata();
    if (!receivedMetadataChange) update(metadata);
  }

  if (!isGm || !isPrivate) {
    return;
  }

  closeButton.hidden = false;
  closeButton.addEventListener("click", () => OBR.modal.close(VIEWER_MODAL_ID));

  if (initialContentType === "asset" || initialContentType === "text" || isImageLink(initialUrl)) {
    container.classList.add("dismissable");
    container.addEventListener("click", () => OBR.modal.close(VIEWER_MODAL_ID));
  }
});
