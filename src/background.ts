import OBR from "@owlbear-rodeo/sdk";
import {
  EXTENSION_ID,
  CONTEXT_MENU_CONFIGURE_ID,
  BROADCAST_SHOW_CHANNEL,
  BROADCAST_HIDE_CHANNEL,
  PREVIEW_POPOVER_ID,
  PREVIEW_SIZE_KEY,
  PREVIEW_LOCATION_KEY,
  VIEWER_MODAL_ID,
  METADATA_KEY,
  MAX_HANDOUT_LINKS,
  createHandoutMetadata,
  readHandoutLinks,
  readPreviewSize,
  readPreviewLocation,
  PreviewLocation,
  ModalContentType,
  ModalShowMessage,
} from "./constants";

function viewerUrl(url: string, contentType: ModalContentType, mode: "private" | "player"): string {
  return `/viewer.html?${new URLSearchParams({ url, contentType, mode })}`;
}

function previewUrl(message: ModalShowMessage): string {
  return `/preview.html?${new URLSearchParams({ id: message.id, url: message.url, contentType: message.contentType, tokenName: message.tokenName || "Token", assetName: message.assetName || "" })}`;
}

const MENU_HEIGHTS = [150, 150, 220, 290];

async function syncLinkCounts() {
  const items = await OBR.scene.items.getItems();
  const staleIds = items.flatMap((item) => {
    const value = item.metadata[METADATA_KEY];
    const links = readHandoutLinks(value);
    if (!links.length) return [];
    const savedCount = value && typeof value === "object"
      ? (value as { linkCount?: unknown }).linkCount
      : undefined;
    return savedCount === links.length ? [] : [item.id];
  });
  if (!staleIds.length) return;
  await OBR.scene.items.updateItems(staleIds, (itemsToUpdate) => {
    for (const item of itemsToUpdate) {
      const links = readHandoutLinks(item.metadata[METADATA_KEY]);
      if (links.length) item.metadata[METADATA_KEY] = createHandoutMetadata(links);
    }
  });
}

OBR.onReady(async () => {
  const isGm = (await OBR.player.getRole()) === "GM";
  let activeShowId: string | undefined;
  let activeShowMessage: ModalShowMessage | undefined;
  let activePreviewLocation: PreviewLocation | undefined;

  const openGmPreview = async (message: ModalShowMessage) => {
    const [viewportWidth, viewportHeight, metadata] = await Promise.all([
      OBR.viewport.getWidth(), OBR.viewport.getHeight(), OBR.room.getMetadata(),
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
    await Promise.all(Array.from({ length: MAX_HANDOUT_LINKS + 1 }, (_, count) =>
      OBR.contextMenu.create({
        id: `${CONTEXT_MENU_CONFIGURE_ID}-${count}`,
        icons: [{
          icon: "/menu-icon.svg",
          label: "Handouts",
          filter: {
            max: 1,
            roles: ["GM"],
            every: [{
              key: ["metadata", METADATA_KEY, "linkCount"],
              value: count === 0 ? undefined : count,
            }],
          },
        }],
        embed: {
          url: `/configure.html?rows=${Math.max(1, count)}`,
          height: MENU_HEIGHTS[count],
        },
      })),
    );

    if (await OBR.scene.isReady()) {
      await syncLinkCounts();
    } else {
      const unsubscribe = OBR.scene.onReadyChange((ready) => {
        if (!ready) return;
        unsubscribe();
        void syncLinkCounts();
      });
    }
  }

  OBR.broadcast.onMessage(BROADCAST_SHOW_CHANNEL, async (event) => {
    const message = event.data as ModalShowMessage;
    const hadActiveHandout = activeShowId !== undefined;
    activeShowId = message.id;
    if (isGm) {
      activeShowMessage = message;
      if (hadActiveHandout) await OBR.popover.close(PREVIEW_POPOVER_ID);
      await openGmPreview(message);
    } else {
      if (hadActiveHandout) await OBR.modal.close(VIEWER_MODAL_ID);
      if (activeShowId !== message.id) return;
      await OBR.modal.open({
        id: VIEWER_MODAL_ID,
        url: viewerUrl(message.url, message.contentType, "player"),
        fullScreen: true,
        hidePaper: true,
        hideBackdrop: true,
      });
    }
  });

  OBR.broadcast.onMessage(BROADCAST_HIDE_CHANNEL, async (event) => {
    if (event.data !== activeShowId) return;
    activeShowId = undefined;
    activeShowMessage = undefined;
    activePreviewLocation = undefined;
    if (isGm) await OBR.popover.close(PREVIEW_POPOVER_ID);
    else await OBR.modal.close(VIEWER_MODAL_ID);
  });

  if (isGm) {
    OBR.room.onMetadataChange(async (metadata) => {
      const message = activeShowMessage;
      if (!message || activeShowId !== message.id) return;
      const location = readPreviewLocation(metadata[PREVIEW_LOCATION_KEY]);
      if (location !== activePreviewLocation) {
        await OBR.popover.close(PREVIEW_POPOVER_ID);
        if (activeShowId === message.id) await openGmPreview(message);
        return;
      }
      const size = readPreviewSize(metadata[PREVIEW_SIZE_KEY]);
      await Promise.allSettled([
        OBR.popover.setWidth(PREVIEW_POPOVER_ID, size.width),
        OBR.popover.setHeight(PREVIEW_POPOVER_ID, size.height),
      ]);
    });
  }
});
