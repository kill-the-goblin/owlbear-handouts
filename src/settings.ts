import OBR, { Item, isImage } from "@owlbear-rodeo/sdk";
import { assetLabel, chooseAsset } from "./assets";
import { presentHandout } from "./presentation";
import { exportHandouts, parseHandoutExport } from "./transfer";
import { version } from "../package.json";
import {
  VIEWER_MODAL_ID, METADATA_KEY, SCENE_HANDOUTS_KEY,
  PREVIEW_SIZE_KEY, PREVIEW_LOCATION_KEY, PREVIEW_POPOVER_ID,
  DEFAULT_PREVIEW_SIZE, readPreviewSize, readPreviewLocation,
  readHandoutLinks, readSceneHandouts, switchHandoutType, reorderHandouts, moveHandout,
  SceneHandout, ModalContentType, ModalShowMessage,
} from "./constants";

const listEl = document.querySelector<HTMLUListElement>("#list")!;
const emptyEl = document.querySelector<HTMLDivElement>("#empty")!;
const countEl = document.querySelector<HTMLSpanElement>("#header-count")!;
const searchInput = document.querySelector<HTMLInputElement>("#search")!;
const addButton = document.querySelector<HTMLButtonElement>("#add-handout")!;
const exportButton = document.querySelector<HTMLButtonElement>("#export-handouts")!;
const importButton = document.querySelector<HTMLButtonElement>("#import-handouts")!;
const importFile = document.querySelector<HTMLInputElement>("#import-file")!;
const importDialog = document.querySelector<HTMLDialogElement>("#import-dialog")!;
const importSummary = document.querySelector<HTMLParagraphElement>("#import-summary")!;
const statusEl = document.querySelector<HTMLDivElement>("#status")!;
const previewSizeInput = document.querySelector<HTMLInputElement>("#preview-size")!;
const previewLocationSelect = document.querySelector<HTMLSelectElement>("#preview-location")!;
const previewSettings = document.querySelector<HTMLDivElement>("#preview-settings")!;
document.querySelector<HTMLSpanElement>("#header-version")!.textContent = version;

const EYE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const CAST_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="20" x2="2.01" y2="20"/></svg>';
const GRIP_ICON = '<svg viewBox="0 0 16 20" width="12" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/><circle cx="5" cy="10" r="1.3"/><circle cx="11" cy="10" r="1.3"/><circle cx="5" cy="16" r="1.3"/><circle cx="11" cy="16" r="1.3"/></svg>';

let handouts: SceneHandout[] = [];
const expandedIds = new Set<string>();
let saveQueue: Promise<void> = Promise.resolve();
let sceneReady = false;
let sceneGeneration = 0;
let drag: { row: HTMLLIElement; pointerId: number; startY: number; y: number; active: boolean; frame: number | null } | null = null;
addButton.disabled = true;
exportButton.disabled = true;
importButton.disabled = true;

function legacyTokenName(item: Item): string {
  return isImage(item) && item.text.plainText.trim()
    ? item.text.plainText.trim()
    : item.name || "Handout";
}

async function loadScene() {
  if (!(await OBR.scene.isReady())) return;
  sceneReady = true;
  statusEl.textContent = "";
  let metadata = await OBR.scene.getMetadata();
  if (metadata[SCENE_HANDOUTS_KEY] === undefined) {
    // Copy existing token handouts once. Keep their old metadata untouched so
    // an interrupted migration cannot destroy the originals.
    const items = await OBR.scene.items.getItems<Item>();
    const imported = items.flatMap((item) => readHandoutLinks(item.metadata[METADATA_KEY]).map((link) => ({
      id: crypto.randomUUID(),
      title: link.name || legacyTokenName(item),
      type: link.type,
      url: link.url,
      ...(link.name ? { name: link.name } : {}),
    })));
    try {
      await OBR.scene.setMetadata({ [SCENE_HANDOUTS_KEY]: imported });
      metadata = await OBR.scene.getMetadata();
      if (imported.length) statusEl.textContent = `Imported ${imported.length} token handout${imported.length === 1 ? "" : "s"}.`;
    } catch {
      sceneReady = false;
      statusEl.textContent = "Could not import token handouts. Existing token data is safe.";
      return;
    }
  }
  handouts = readSceneHandouts(metadata[SCENE_HANDOUTS_KEY]);
  addButton.disabled = false;
  exportButton.disabled = false;
  importButton.disabled = false;
  render();
}

function render() {
  if (drag) cancelDrag();
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visible = handouts.filter((handout) => handout.title.toLocaleLowerCase().includes(query));
  countEl.textContent = `${handouts.length} Handout${handouts.length === 1 ? "" : "s"}`;
  listEl.replaceChildren(...visible.map((handout) => buildRow(handout, !query && handouts.length > 1)));
  emptyEl.hidden = visible.length > 0;
  emptyEl.textContent = handouts.length === 0
    ? "No handouts in this scene yet."
    : "No handouts match your search.";
}

function cancelDrag() {
  if (!drag) return;
  if (drag.frame !== null) cancelAnimationFrame(drag.frame);
  drag.row.classList.remove("is-dragging");
  if (listEl.hasPointerCapture(drag.pointerId)) listEl.releasePointerCapture(drag.pointerId);
  drag = null;
}

function positionDraggedRow() {
  if (!drag?.active) return;
  const bounds = listEl.getBoundingClientRect();
  if (drag.y < bounds.top + 32) listEl.scrollTop -= 8;
  if (drag.y > bounds.bottom - 32) listEl.scrollTop += 8;
  const others = [...listEl.children].filter((child) => child !== drag!.row) as HTMLLIElement[];
  const before = others.find((row) => drag!.y < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
  listEl.insertBefore(drag.row, before ?? null);
  drag.frame = requestAnimationFrame(positionDraggedRow);
}

function beginDrag(event: PointerEvent, row: HTMLLIElement) {
  if (drag || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  listEl.setPointerCapture(event.pointerId);
  drag = { row, pointerId: event.pointerId, startY: event.clientY, y: event.clientY, active: false, frame: null };
}

function focusHandle(id: string) {
  const row = [...listEl.children].find((child) => (child as HTMLLIElement).dataset.handoutId === id);
  const handle = row?.querySelector<HTMLButtonElement>(".drag-handle");
  handle?.focus({ preventScroll: true });
  row?.scrollIntoView({ block: "nearest" });
}

async function changeList(update: (list: SceneHandout[]) => SceneHandout[], expectedGeneration?: number) {
  const write = saveQueue.catch(() => {}).then(async () => {
    if (!sceneReady) {
      if (expectedGeneration !== undefined) throw new Error("Scene changed during import.");
      return;
    }
    if (expectedGeneration !== undefined && expectedGeneration !== sceneGeneration) throw new Error("Scene changed during import.");
    const metadata = await OBR.scene.getMetadata();
    if (expectedGeneration !== undefined && expectedGeneration !== sceneGeneration) throw new Error("Scene changed during import.");
    const next = update(readSceneHandouts(metadata[SCENE_HANDOUTS_KEY]));
    await OBR.scene.setMetadata({ [SCENE_HANDOUTS_KEY]: next });
    handouts = next;
    statusEl.textContent = "";
    render();
  });
  saveQueue = write;
  try {
    await write;
  } catch {
    statusEl.textContent = "Could not save handouts. Your previous list is still stored.";
    throw new Error("Could not save handouts");
  }
}

function updateHandout(id: string, changes: Partial<SceneHandout>) {
  return changeList((list) => list.map((entry) => entry.id === id ? { ...entry, ...changes } : entry));
}

function actionButton(icon: string, title: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.innerHTML = icon;
  button.title = title;
  button.setAttribute("aria-label", title);
  return button;
}

function buildRow(handout: SceneHandout, canReorder: boolean): HTMLLIElement {
  const li = document.createElement("li");
  li.dataset.handoutId = handout.id;
  const top = document.createElement("div");
  top.className = "entry-top";
  const expanded = expandedIds.has(handout.id);
  li.classList.toggle("is-expanded", expanded);
  const handle = actionButton(GRIP_ICON, canReorder
    ? `Reorder ${handout.title}; use arrow keys`
    : "Clear search to reorder handouts");
  handle.classList.add("drag-handle");
  handle.disabled = !canReorder;
  handle.addEventListener("pointerdown", (event) => beginDrag(event, li));
  handle.addEventListener("keydown", async (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? -1 : 1;
    try {
      await changeList((list) => moveHandout(list, handout.id, direction));
      focusHandle(handout.id);
    } catch { /* Status is shown by changeList. */ }
  });
  const expand = actionButton(expanded ? "▾" : "▸", `${expanded ? "Hide" : "Edit"} ${handout.title} details`);
  expand.classList.add("expand-button");
  expand.setAttribute("aria-expanded", String(expanded));
  const title = document.createElement("input");
  title.className = "entry-name";
  title.type = "text";
  title.value = handout.title;
  title.placeholder = "Handout name";
  title.title = "Rename Handout";
  title.setAttribute("aria-label", "Handout name");
  title.addEventListener("keydown", (event) => { if (event.key === "Enter") title.blur(); });
  title.addEventListener("change", async () => {
    const next = title.value.trim();
    if (!next) { title.value = handout.title; return; }
    try { await updateHandout(handout.id, { title: next }); }
    catch { title.value = handout.title; }
  });

  const view = actionButton(EYE_ICON, `View ${handout.title} privately`);
  const present = actionButton(CAST_ICON, `Present ${handout.title} to players`);
  const remove = actionButton("×", `Delete ${handout.title}`);
  remove.classList.add("delete-button");
  view.disabled = !handout.url.trim();
  present.disabled = !handout.url.trim();
  view.addEventListener("click", async () => {
    try { await saveQueue; } catch { return; }
    const current = handouts.find((entry) => entry.id === handout.id);
    if (!current?.url.trim()) return;
    await OBR.modal.open({
      id: VIEWER_MODAL_ID,
      url: `/viewer.html?${new URLSearchParams({ url: current.url, contentType: current.type, mode: "private" })}`,
      fullScreen: true, hidePaper: true, hideBackdrop: true,
    });
  });
  present.addEventListener("click", async () => {
    try { await saveQueue; } catch { return; }
    const current = handouts.find((entry) => entry.id === handout.id);
    if (!current?.url.trim()) return;
    const message: ModalShowMessage = {
      id: crypto.randomUUID(), url: current.url, contentType: current.type,
      handoutName: current.title, assetName: current.name,
    };
    await presentHandout(message);
  });
  remove.addEventListener("click", async () => {
    if (!confirm(`Delete “${handout.title}” from this scene?`)) return;
    try {
      await changeList((list) => list.filter((entry) => entry.id !== handout.id));
      expandedIds.delete(handout.id);
    }
    catch { /* Status is shown by changeList. */ }
  });
  top.append(handle, expand, title, remove, view, present);

  const bottom = document.createElement("div");
  bottom.className = "entry-bottom";
  bottom.hidden = !expanded;
  expand.addEventListener("click", () => {
    const open = !expandedIds.has(handout.id);
    if (open) expandedIds.add(handout.id);
    else expandedIds.delete(handout.id);
    li.classList.toggle("is-expanded", open);
    bottom.hidden = !open;
    expand.textContent = open ? "▾" : "▸";
    expand.title = `${open ? "Hide" : "Edit"} ${handout.title} details`;
    expand.setAttribute("aria-label", expand.title);
    expand.setAttribute("aria-expanded", String(open));
  });
  const type = document.createElement("select");
  type.className = "entry-type";
  type.setAttribute("aria-label", `${handout.title} type`);
  for (const [value, label] of [["asset", "Asset"], ["link", "Link"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    type.append(option);
  }
  type.value = handout.type;

  const url = document.createElement("input");
  url.className = "entry-url";
  url.type = "url";
  url.placeholder = "Add URL...";
  url.value = handout.url;
  url.title = handout.url;
  url.hidden = handout.type === "asset";
  url.setAttribute("aria-label", `${handout.title} URL`);
  url.addEventListener("keydown", (event) => { if (event.key === "Enter") url.blur(); });
  url.addEventListener("input", () => {
    view.disabled = !url.value.trim();
    present.disabled = !url.value.trim();
  });
  url.addEventListener("change", async () => {
    try { await updateHandout(handout.id, { url: url.value.trim() }); }
    catch { url.value = handout.url; }
  });

  const picker = document.createElement("button");
  picker.type = "button";
  picker.className = "asset-picker";
  picker.textContent = handout.name ? assetLabel(handout.name, handout.assetCategory) : "Choose Asset...";
  picker.classList.toggle("is-placeholder", !handout.name);
  picker.title = handout.name ? assetLabel(handout.name, handout.assetCategory) : "Choose an Owlbear asset";
  picker.hidden = handout.type !== "asset";
  picker.addEventListener("click", async () => {
    try {
      const asset = await chooseAsset();
      if (asset) await updateHandout(handout.id, { url: asset.url, name: asset.name, assetCategory: asset.category });
    } catch { statusEl.textContent = "Could not choose or save that asset."; }
  });
  type.addEventListener("change", async () => {
    const next = type.value as ModalContentType;
    try {
      await saveQueue;
      await changeList((list) => list.map((entry) =>
        entry.id === handout.id ? switchHandoutType(entry, next) : entry,
      ));
    }
    catch { type.value = handout.type; }
  });
  bottom.append(type, url, picker);
  li.append(top, bottom);
  return li;
}

function showGmOnlyMessage() {
  listEl.replaceChildren();
  emptyEl.hidden = false;
  emptyEl.textContent = "This panel is GM-only.";
  countEl.textContent = "";
  document.querySelector<HTMLDivElement>("#list-tools")!.hidden = true;
  document.querySelector<HTMLDivElement>("#transfer-tools")!.hidden = true;
  previewSettings.hidden = true;
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    showGmOnlyMessage();
    return;
  }

  searchInput.addEventListener("input", render);
  listEl.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.y = event.clientY;
    if (!drag.active && Math.abs(drag.y - drag.startY) > 4) {
      drag.active = true;
      drag.row.classList.add("is-dragging");
      drag.frame = requestAnimationFrame(positionDraggedRow);
    }
  });
  listEl.addEventListener("pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const changed = drag.active;
    if (changed) positionDraggedRow();
    const ids = [...listEl.children].map((row) => (row as HTMLLIElement).dataset.handoutId!);
    cancelDrag();
    if (changed) void changeList((list) => reorderHandouts(list, ids)).catch(() => render());
  });
  listEl.addEventListener("pointercancel", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    cancelDrag();
    render();
  });
  addButton.addEventListener("click", async () => {
    const entry: SceneHandout = { id: crypto.randomUUID(), title: "Handout", type: "asset", url: "" };
    try {
      expandedIds.add(entry.id);
      await changeList((list) => [...list, entry]);
      searchInput.value = "";
      render();
      listEl.scrollTop = listEl.scrollHeight;
      const nameInput = listEl.lastElementChild?.querySelector<HTMLInputElement>(".entry-name");
      nameInput?.focus({ preventScroll: true });
      nameInput?.select();
    } catch {
      expandedIds.delete(entry.id);
      /* Status is shown by changeList. */
    }
  });
  exportButton.addEventListener("click", async () => {
    try {
      await saveQueue;
      if (!sceneReady) return;
      const metadata = await OBR.scene.getMetadata();
      const list = readSceneHandouts(metadata[SCENE_HANDOUTS_KEY]);
      const blob = new Blob([exportHandouts(list)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = url;
      download.download = `handouts-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(download);
      download.click();
      download.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      statusEl.textContent = `Exported ${list.length} handout${list.length === 1 ? "" : "s"}.`;
    } catch {
      statusEl.textContent = "Could not export handouts.";
    }
  });
  importButton.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (!file || !sceneReady) return;
    if (file.size > 2 * 1024 * 1024) {
      statusEl.textContent = "Import file is too large (2 MB maximum).";
      return;
    }
    const destinationGeneration = sceneGeneration;
    try {
      const imported = parseHandoutExport(await file.text());
      if (!sceneReady || destinationGeneration !== sceneGeneration) return;
      importSummary.textContent = `Import ${imported.length} handout${imported.length === 1 ? "" : "s"} into this scene?`;
      importDialog.returnValue = "cancel";
      importDialog.showModal();
      const choice = await new Promise<string>((resolve) => {
        importDialog.addEventListener("close", () => resolve(importDialog.returnValue), { once: true });
      });
      if (!sceneReady || destinationGeneration !== sceneGeneration || (choice !== "append" && choice !== "replace")) return;
      const copies = imported.map((entry) => ({ ...entry, id: crypto.randomUUID() }));
      await changeList((list) => choice === "replace" ? copies : [...list, ...copies], destinationGeneration);
      searchInput.value = "";
      render();
    } catch (error) {
      statusEl.textContent = error instanceof SyntaxError
        ? "Could not read JSON file. Nothing was imported."
        : error instanceof Error ? error.message : "Could not import handouts.";
    }
  });
  OBR.scene.onMetadataChange((metadata) => {
    if (!sceneReady) return;
    const next = readSceneHandouts(metadata[SCENE_HANDOUTS_KEY]);
    if (JSON.stringify(next) === JSON.stringify(handouts)) return;
    handouts = next;
    render();
  });
  OBR.scene.onReadyChange((ready) => {
    sceneGeneration++;
    sceneReady = ready;
    if (ready) void loadScene();
    else {
      if (importDialog.open) importDialog.close("cancel");
      handouts = [];
      addButton.disabled = true;
      exportButton.disabled = true;
      importButton.disabled = true;
      render();
    }
  });
  if (await OBR.scene.isReady()) await loadScene();
  else statusEl.textContent = "Open a scene to manage its handouts.";

  const metadata = await OBR.room.getMetadata();
  const initialSize = readPreviewSize(metadata[PREVIEW_SIZE_KEY]).height;
  previewSizeInput.value = String(initialSize);
  previewLocationSelect.value = readPreviewLocation(metadata[PREVIEW_LOCATION_KEY]);
  previewLocationSelect.addEventListener("change", async () => {
    await OBR.room.setMetadata({ [PREVIEW_LOCATION_KEY]: readPreviewLocation(previewLocationSelect.value) });
  });
  if (metadata[PREVIEW_SIZE_KEY] === undefined) {
    await OBR.room.setMetadata({ [PREVIEW_SIZE_KEY]: DEFAULT_PREVIEW_SIZE });
  }
  await resizeOpenPreview(initialSize);
  previewSizeInput.addEventListener("change", async () => {
    const size = previewSizeInput.valueAsNumber;
    if (!Number.isFinite(size)) {
      const current = await OBR.room.getMetadata();
      previewSizeInput.value = String(readPreviewSize(current[PREVIEW_SIZE_KEY]).height);
      return;
    }
    const clamped = readPreviewSize({ height: size });
    previewSizeInput.value = String(clamped.height);
    await OBR.room.setMetadata({ [PREVIEW_SIZE_KEY]: clamped });
    await resizeOpenPreview(clamped.height);
  });
});

async function resizeOpenPreview(size: number) {
  const { width, height } = readPreviewSize({ height: size });
  await Promise.allSettled([
    OBR.popover.setWidth(PREVIEW_POPOVER_ID, width),
    OBR.popover.setHeight(PREVIEW_POPOVER_ID, height),
  ]);
}
