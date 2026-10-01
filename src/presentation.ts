import OBR from "@owlbear-rodeo/sdk";
import {
  ACTIVE_PRESENTATION_KEY,
  ModalShowMessage,
  readActivePresentation,
} from "./constants";

export async function presentHandout(message: ModalShowMessage): Promise<void> {
  await OBR.room.setMetadata({
    [ACTIVE_PRESENTATION_KEY]: {
      id: message.id,
      url: message.url,
      contentType: message.contentType,
      handoutName: message.handoutName,
      presenterConnectionId: await OBR.player.getConnectionId(),
      ...(message.assetName ? { assetName: message.assetName } : {}),
    },
  });
}

export async function dismissHandout(id: string): Promise<void> {
  const metadata = await OBR.room.getMetadata();
  if (readActivePresentation(metadata[ACTIVE_PRESENTATION_KEY])?.id !== id) return;
  await OBR.room.setMetadata({ [ACTIVE_PRESENTATION_KEY]: null });
}
