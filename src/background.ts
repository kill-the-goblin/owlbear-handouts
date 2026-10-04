import OBR from "@owlbear-rodeo/sdk";
import {
  EXTENSION_ID,
  CONTEXT_MENU_CONFIGURE_ID,
  ACTIVE_PRESENTATION_KEY,
  PREVIEW_POPOVER_ID,
  PREVIEW_SIZE_KEY,
  PREVIEW_LOCATION_KEY,
  VIEWER_MODAL_ID,
  MAX_HANDOUT_LINKS,
  readPreviewSize,
  readPreviewLocation,
  readActivePresentation,
  PreviewLocation,
  ModalShowMessage,
  ActivePresentation,
} from "./constants";

function viewerUrl(message: ModalShowMessage): string {
  return `/viewer.html?${new URLSearchParams({ id: message.id, url: message.url, contentType: message.contentType, mode: "player" })}`;
}

function previewUrl(message: ModalShowMessage): string {
  return `/preview.html?${new URLSearchParams({ id: message.id, url: message.url, contentType: message.contentType, handoutName: message.handoutName || "Handout", assetName: message.assetName || "" })}`;
}

OBR.onReady(async () => {
  const isGm = (await OBR.player.getRole()) === "GM";
  const ownConnectionId = await OBR.player.getConnectionId();
  let activeShowId: string | undefined;
  let activeShowMessage: ActivePresentation | undefined;
  let activePreviewLocation: PreviewLocation | undefined;
  let latestMetadata: Record<string, unknown> | undefined;
  let syncQueue: Promise<void> = Promise.resolve();

  const openGmPreview = async (message: ActivePresentation, metadata: Record<string, unknown>) => {
    const [viewportWidth, viewportHeight] = await Promise.all([
      OBR.viewport.getWidth(), OBR.viewport.getHeight(),
    ]);
    if (activeShowId !== message.id) return;
    const size = readPreviewSize(metadata[PREVIEW_SIZE_KEY]);
    const location = readPreviewLocation(metadata[PREVIEW_LOCATION_KEY]);
    const horizontal = location.endsWith("right") ? "RIGHT" : "LEFT";
    const vertical = location.startsWith("top") ? "TOP" : "BOTTOM";
    await OBR.popover.open({
      id: PREVIEW_POPOVER_ID,
      url: previewUrl(message),
      width: size.width,
      height: size.height,
      anchorReference: "POSITION",
      anchorPosition: {
        left: horizontal === "RIGHT" ? viewportWidth - 16 : 16,
        top: vertical === "TOP" ? 80 : viewportHeight - 80,
      },
      anchorOrigin: { horizontal, vertical },
      transformOrigin: { horizontal, vertical },
      disableClickAway: true,
    });
    activePreviewLocation = location;
  };

  if (isGm) {
    // Remove the four standalone actions left by an already loaded older build.
    await Promise.all([
      "view-image", "show-image", "view-page", "show-page",
    ].map((suffix) => OBR.contextMenu.remove(`${EXTENSION_ID}/${suffix}`)));
    await Promise.all([
      OBR.contextMenu.remove(CONTEXT_MENU_CONFIGURE_ID),
      ...Array.from({ length: MAX_HANDOUT_LINKS + 1 }, (_, count) =>
        OBR.contextMenu.remove(`${CONTEXT_MENU_CONFIGURE_ID}-${count}`)),
    ]);
  }

  const synchronize = async () => {
    const metadata = latestMetadata;
    if (!metadata) return;
    const stored = readActivePresentation(metadata[ACTIVE_PRESENTATION_KEY]);
    const presenterConnected = stored && (
      stored.presenterConnectionId === ownConnectionId ||
      (await OBR.party.getPlayers()).some((player) => player.connectionId === stored.presenterConnectionId)
    );
    const message = presenterConnected ? stored : undefined;

    if (activeShowId !== message?.id) {
      const hadActivePresentation = Boolean(activeShowId);
      if (activeShowId) {
        if (isGm) await OBR.popover.close(PREVIEW_POPOVER_ID);
        else if (!message) await OBR.modal.close(VIEWER_MODAL_ID);
      }
      activeShowId = message?.id;
      activeShowMessage = isGm ? message : undefined;
      activePreviewLocation = undefined;
      if (!message) return;

      if (isGm) {
        await openGmPreview(message, metadata);
      } else if (!hadActivePresentation) {
        // The player viewer stays mounted while a presentation is replaced.
        // It swaps content on room metadata changes over a black background.
        await OBR.modal.open({
          id: VIEWER_MODAL_ID,
          url: viewerUrl(message),
          fullScreen: true,
          hidePaper: true,
          hideBackdrop: true,
        });
      }
      return;
    }

    if (!isGm || !activeShowMessage) return;
    const location = readPreviewLocation(metadata[PREVIEW_LOCATION_KEY]);
    if (location !== activePreviewLocation) {
      await OBR.popover.close(PREVIEW_POPOVER_ID);
      await openGmPreview(activeShowMessage, metadata);
      return;
    }
    const size = readPreviewSize(metadata[PREVIEW_SIZE_KEY]);
    await Promise.allSettled([
      OBR.popover.setWidth(PREVIEW_POPOVER_ID, size.width),
      OBR.popover.setHeight(PREVIEW_POPOVER_ID, size.height),
    ]);
  };

  const queueSync = () => {
    syncQueue = syncQueue.catch(() => {}).then(synchronize);
  };

  // Subscribe before reading the initial value, so a change during startup
  // cannot be replaced by an older snapshot.
  let receivedMetadataChange = false;
  OBR.room.onMetadataChange((metadata) => {
    receivedMetadataChange = true;
    latestMetadata = metadata;
    queueSync();
  });
  OBR.party.onChange(() => {
    if (latestMetadata) queueSync();
  });
  const initialMetadata = await OBR.room.getMetadata();
  if (!receivedMetadataChange) {
    latestMetadata = initialMetadata;
    queueSync();
  }
});
