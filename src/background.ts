import OBR from "@owlbear-rodeo/sdk";
import {
  EXTENSION_ID,
  CONTEXT_MENU_CONFIGURE_ID,
  ACTIVE_PRESENTATION_KEY,
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
  readActivePresentation,
  PreviewLocation,
  ModalContentType,
  ModalShowMessage,
  ActivePresentation,
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
      if (activeShowId) {
        if (isGm) await OBR.popover.close(PREVIEW_POPOVER_ID);
        else await OBR.modal.close(VIEWER_MODAL_ID);
      }
      activeShowId = message?.id;
      activeShowMessage = isGm ? message : undefined;
      activePreviewLocation = undefined;
      if (!message) return;

      if (isGm) {
        await openGmPreview(message, metadata);
      } else {
        await OBR.modal.open({
          id: VIEWER_MODAL_ID,
          url: viewerUrl(message.url, message.contentType, "player"),
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
