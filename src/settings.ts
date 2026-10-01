import OBR, { BoundingBox, Item, isImage } from "@owlbear-rodeo/sdk";
import { chooseAsset } from "./assets";
import { presentHandout } from "./presentation";
import { version } from "../package.json";
import {
  VIEWER_MODAL_ID,
  METADATA_KEY,
  PREVIEW_SIZE_KEY,
  PREVIEW_LOCATION_KEY,
  PREVIEW_POPOVER_ID,
  DEFAULT_PREVIEW_SIZE,
  MAX_HANDOUT_LINKS,
  createHandoutMetadata,
  readPreviewSize,
  readPreviewLocation,
  readHandoutLinks,
  HandoutLink,
  ModalContentType,
  ModalShowMessage,
} from "./constants";

const listEl = document.querySelector<HTMLUListElement>("#list")!;
const emptyEl = document.querySelector<HTMLDivElement>("#empty")!;
const headerCountEl = document.querySelector<HTMLSpanElement>("#header-count")!;
document.querySelector<HTMLSpanElement>("#header-version")!.textContent = version;
const previewSizeInput = document.querySelector<HTMLInputElement>("#preview-size")!;
const previewLocationSelect = document.querySelector<HTMLSelectElement>("#preview-location")!;
const previewSettings = document.querySelector<HTMLDivElement>("#preview-settings")!;

const EYE_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const CAST_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="20" x2="2.01" y2="20"/></svg>';
const FOCUS_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/></svg>';

// How far to zoom out beyond the token's own bounding box when focusing it;
// animateToBounds fits the given box exactly, so passing the raw item
// bounds zooms in tight to just the token itself.
const FOCUS_PADDING_FACTOR = 6;

function hasHandoutLink(item: Item): boolean {
  return readHandoutLinks(item.metadata[METADATA_KEY]).length > 0;
}

// Prefer the on-screen nameplate text (what's actually shown under the
// token, e.g. "Sahuagin Zombies 1") over the item's canonical asset name
// (e.g. "Sahuagin Undead"), since that's what a GM recognizes at a glance.
function displayName(item: Item): string {
  if (isImage(item) && item.text.plainText.trim()) {
    return item.text.plainText.trim();
  }
  return item.name || "(unnamed token)";
}

function buildLinkRow(
  itemId: string,
  tokenName: string,
  index: number,
  link: HandoutLink,
  onDraftRemoved?: () => void,
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "link-row";

  const number = document.createElement("span");
  number.className = "link-number";
  number.textContent = `${index + 1}.`;

  const typeSelect = document.createElement("select");
  typeSelect.className = "link-type";
  typeSelect.setAttribute("aria-label", `Link ${index + 1} type`);
  for (const type of ["asset", "link"] as const) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type === "asset" ? "Asset" : "Link";
    typeSelect.appendChild(option);
  }
  typeSelect.value = link.type;
  typeSelect.addEventListener("click", (event) => event.stopPropagation());

  const urlInput = document.createElement("input");
  urlInput.className = "link-url";
  urlInput.type = "url";
  urlInput.placeholder = "Add URL...";
  urlInput.value = link.url;
  urlInput.title = link.url;
  urlInput.setAttribute("aria-label", `Link ${index + 1} URL`);
  urlInput.addEventListener("click", (event) => event.stopPropagation());
  urlInput.hidden = link.type === "asset";

  const picker = document.createElement("button");
  picker.type = "button";
  picker.className = "asset-picker";
  picker.textContent = link.type === "asset" ? link.name || "Choose Asset..." : "Choose Asset...";
  picker.classList.toggle("is-placeholder", link.type !== "asset" || !link.name);
  picker.title = link.type === "asset" ? link.name || link.url : "Choose an Owlbear asset";
  picker.hidden = link.type !== "asset";
  picker.addEventListener("click", (event) => event.stopPropagation());
  let assetName = link.name;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-link";
  removeButton.textContent = "×";
  removeButton.title = `Remove link ${index + 1}`;
  removeButton.setAttribute("aria-label", removeButton.title);

  const viewButton = document.createElement("button");
  viewButton.type = "button";
  viewButton.className = "link-action";
  viewButton.innerHTML = EYE_ICON_SVG;

  const showButton = document.createElement("button");
  showButton.type = "button";
  showButton.className = "link-action";
  showButton.innerHTML = CAST_ICON_SVG;

  const updateButtons = () => {
    viewButton.title = `View ${typeSelect.value} privately`;
    viewButton.setAttribute("aria-label", viewButton.title);
    showButton.title = `Present ${typeSelect.value} to players`;
    showButton.setAttribute("aria-label", showButton.title);
    const hasSelection = Boolean(urlInput.value.trim()) &&
      (typeSelect.value !== "asset" || link.type === "asset");
    showButton.disabled = !hasSelection;
    viewButton.disabled = !hasSelection;
  };
  updateButtons();
  urlInput.addEventListener("input", updateButtons);
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      urlInput.blur();
    }
  });

  let isDraft = Boolean(onDraftRemoved);
  const saveCurrent = async () => {
    const updated: HandoutLink = {
      type: typeSelect.value as ModalContentType,
      url: urlInput.value.trim(),
      ...(typeSelect.value === "asset" ? { name: assetName } : {}),
    };
    if (!updated.url) {
      if (!isDraft && typeSelect.value !== "asset" && link.type !== "asset") {
        await removeLink(itemId, index);
      }
      return false;
    }
    if (isDraft || updated.type !== link.type || updated.url !== link.url || updated.name !== link.name) {
      await saveLink(itemId, index, updated);
      isDraft = false;
      link = updated;
    }
    return true;
  };
  typeSelect.addEventListener("change", () => {
    const isAsset = typeSelect.value === "asset";
    urlInput.hidden = isAsset;
    picker.hidden = !isAsset;
    if (isAsset) {
      if (link.type === "asset") urlInput.value = link.url;
      picker.textContent = link.type === "asset" ? link.name || "Choose Asset..." : "Choose Asset...";
      picker.classList.toggle("is-placeholder", link.type !== "asset" || !link.name);
    } else if (link.type === "asset") {
      urlInput.value = "";
      urlInput.title = "";
    } else if (!isDraft) {
      void saveCurrent();
    }
    updateButtons();
  });
  picker.addEventListener("click", async () => {
    try {
      const asset = await chooseAsset();
      if (!asset) return;
      urlInput.value = asset.url;
      assetName = asset.name;
      picker.textContent = asset.name;
      picker.classList.remove("is-placeholder");
      picker.title = asset.name;
      updateButtons();
      await saveCurrent();
      updateButtons();
    } catch {
      picker.title = "Could not open Owlbear asset picker; try again";
    }
  });
  urlInput.addEventListener("change", () => { void saveCurrent(); });

  removeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isDraft) {
      row.remove();
      onDraftRemoved?.();
    } else {
      void removeLink(itemId, index);
    }
  });

  viewButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (await saveCurrent()) await viewLink(urlInput.value.trim(), typeSelect.value as ModalContentType);
  });

  showButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (await saveCurrent()) await showLink(urlInput.value.trim(), typeSelect.value as ModalContentType, tokenName, assetName);
  });

  row.append(number, typeSelect, urlInput, picker, removeButton, viewButton, showButton);
  return row;
}

function render(items: Item[]) {
  const linked = items.filter(hasHandoutLink);

  listEl.replaceChildren();
  emptyEl.hidden = linked.length > 0;
  headerCountEl.textContent = `${linked.length} Token${linked.length === 1 ? "" : "s"}`;

  for (const item of linked) {
    const links = readHandoutLinks(item.metadata[METADATA_KEY]);
    const tokenName = displayName(item);

    const li = document.createElement("li");

    const header = document.createElement("div");
    header.className = "row-header";

    const name = document.createElement("div");
    name.className = "row-name";
    name.textContent = tokenName;

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "link-action add-action";
    addButton.textContent = "+";
    addButton.title = "Add asset or link to token";
    addButton.setAttribute("aria-label", addButton.title);
    addButton.disabled = links.length >= MAX_HANDOUT_LINKS;

    const focusButton = document.createElement("button");
    focusButton.type = "button";
    focusButton.className = "link-action";
    focusButton.title = "Focus view on token";
    focusButton.setAttribute("aria-label", focusButton.title);
    focusButton.innerHTML = FOCUS_ICON_SVG;
    focusButton.addEventListener("click", (event) => {
      event.stopPropagation();
      focusItem(item.id);
    });

    actions.append(addButton, focusButton);
    header.append(name, actions);
    li.appendChild(header);
    const rows = document.createElement("div");
    rows.className = "link-rows";
    links.forEach((link, index) => rows.appendChild(buildLinkRow(item.id, tokenName, index, link)));
    li.appendChild(rows);

    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (addButton.disabled) return;
      addButton.disabled = true;
      const draft = buildLinkRow(item.id, tokenName, links.length, { type: "asset", url: "" }, () => {
        addButton.disabled = false;
      });
      rows.appendChild(draft);
      draft.querySelector<HTMLButtonElement>(".asset-picker")?.focus();
    });
    li.addEventListener("click", () => focusItem(item.id));
    listEl.appendChild(li);
  }
}

async function saveLink(id: string, index: number, link: HandoutLink) {
  await OBR.scene.items.updateItems([id], (items) => {
    for (const item of items) {
      const links = readHandoutLinks(item.metadata[METADATA_KEY]);
      if (index > links.length || index >= MAX_HANDOUT_LINKS) continue;
      links[index] = link;
      item.metadata[METADATA_KEY] = createHandoutMetadata(links);
    }
  });
}

async function removeLink(id: string, index: number) {
  await OBR.scene.items.updateItems([id], (items) => {
    for (const item of items) {
      const links = readHandoutLinks(item.metadata[METADATA_KEY]);
      if (index >= links.length) continue;
      links.splice(index, 1);
      if (links.length) item.metadata[METADATA_KEY] = createHandoutMetadata(links);
      else delete item.metadata[METADATA_KEY];
    }
  });
}

async function viewLink(url: string, contentType: ModalContentType) {
  if (!url) return;
  await OBR.modal.open({
    id: VIEWER_MODAL_ID,
    url: `/viewer.html?${new URLSearchParams({ url, contentType, mode: "private" })}`,
    fullScreen: true,
    hidePaper: true,
    hideBackdrop: true,
  });
}

async function showLink(url: string, contentType: ModalContentType, tokenName: string, assetName?: string) {
  if (!url) {
    return;
  }
  const message: ModalShowMessage = { id: crypto.randomUUID(), url, contentType, tokenName, assetName };
  await presentHandout(message);
}

function padBounds(bounds: BoundingBox, factor: number): BoundingBox {
  const width = bounds.width * factor;
  const height = bounds.height * factor;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return {
    min: { x: bounds.center.x - halfWidth, y: bounds.center.y - halfHeight },
    max: { x: bounds.center.x + halfWidth, y: bounds.center.y + halfHeight },
    width,
    height,
    center: bounds.center,
  };
}

async function focusItem(id: string) {
  await OBR.player.select([id], true);
  const bounds = await OBR.scene.items.getItemBounds([id]);
  await OBR.viewport.animateToBounds(padBounds(bounds, FOCUS_PADDING_FACTOR));
}

function showGmOnlyMessage() {
  listEl.replaceChildren();
  emptyEl.hidden = false;
  emptyEl.textContent = "This panel is GM-only.";
  headerCountEl.textContent = "";
  previewSettings.hidden = true;
}

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    showGmOnlyMessage();
    return;
  }

  OBR.scene.items.getItems<Item>().then(render);
  OBR.scene.items.onChange(render);

  const metadata = await OBR.room.getMetadata();
  const initialSize = readPreviewSize(metadata[PREVIEW_SIZE_KEY]).height;
  previewSizeInput.value = String(initialSize);
  previewLocationSelect.value = readPreviewLocation(metadata[PREVIEW_LOCATION_KEY]);
  previewLocationSelect.addEventListener("change", async () => {
    await OBR.room.setMetadata({
      [PREVIEW_LOCATION_KEY]: readPreviewLocation(previewLocationSelect.value),
    });
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
    const clampedSize = readPreviewSize({ height: size });
    previewSizeInput.value = String(clampedSize.height);
    await OBR.room.setMetadata({ [PREVIEW_SIZE_KEY]: clampedSize });
    await resizeOpenPreview(clampedSize.height);
  });
});

async function resizeOpenPreview(size: number) {
  const { width, height } = readPreviewSize({ height: size });
  await Promise.allSettled([
    OBR.popover.setWidth(PREVIEW_POPOVER_ID, width),
    OBR.popover.setHeight(PREVIEW_POPOVER_ID, height),
  ]);
}
