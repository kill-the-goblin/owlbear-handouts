import { readSceneHandouts, type SceneHandout } from "./constants";

const FORMAT = "owlbear-handouts";
const VERSION = 1;

export function exportHandouts(handouts: SceneHandout[]): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, handouts }, null, 2);
}

export function parseHandoutExport(text: string): SceneHandout[] {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object") throw new Error("Not a Handouts export file.");
  const file = data as Record<string, unknown>;
  if (file.format !== FORMAT || file.version !== VERSION || !Array.isArray(file.handouts)) {
    throw new Error("Not a supported Handouts export file.");
  }
  const handouts = readSceneHandouts(file.handouts);
  if (handouts.length !== file.handouts.length) {
    throw new Error("The file contains an invalid handout. Nothing was imported.");
  }
  return handouts;
}
