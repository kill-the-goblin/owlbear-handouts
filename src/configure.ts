import OBR, { Item, isImage } from "@owlbear-rodeo/sdk";
import { chooseAsset } from "./assets";
import { presentHandout } from "./presentation";
import {
  METADATA_KEY,
  VIEWER_MODAL_ID,
  MAX_HANDOUT_LINKS,
  createHandoutMetadata,
  readHandoutLinks,
  HandoutLink,
  ModalContentType,
  ModalShowMessage,
} from "./constants";

const form = document.querySelector<HTMLFormElement>("#link-form")!;
const linkList = document.querySelector<HTMLDivElement>("#link-list")!;
const addButton = document.querySelector<HTMLButtonElement>("#add-link")!;
const saveStatus = document.querySelector<HTMLSpanElement>("#save-status")!;
const requestedRows = Number(new URLSearchParams(window.location.search).get("rows"));
const visibleRows = Number.isInteger(requestedRows)
  ? Math.min(MAX_HANDOUT_LINKS, Math.max(1, requestedRows))
  : 1;
linkList.style.maxHeight = `${85 + (visibleRows - 1) * 70}px`;
let itemId: string | undefined;
let tokenName = "Token";
let links: HandoutLink[] = [];
let saveQueue: Promise<void> = Promise.resolve();
let saveSequence = 0;

const EYE_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const CAST_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="20" x2="2.01" y2="20"/></svg>';

function displayName(item: Item): string {
  if (isImage(item) && item.text.plainText.trim()) return item.text.plainText.trim();
  return item.name || "(unnamed token)";
}

function actionButton(icon: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "link-action";
  button.innerHTML = icon;
  return button;
}

function updateAddButton() {
  addButton.disabled = !itemId || links.length >= MAX_HANDOUT_LINKS || links.some((link) => !link.url.trim());
}

function renderRows() {
  linkList.replaceChildren();
  updateAddButton();

  links.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "field-row";

    const number = document.createElement("span");
    number.className = "link-number";
    number.textContent = `${index + 1}.`;

    const type = document.createElement("select");
    type.className = "link-type";
    type.setAttribute("aria-label", `Link ${index + 1} type`);
    for (const value of ["asset", "link"] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "asset" ? "Asset" : "Link";
      type.appendChild(option);
    }
    type.value = link.type;

    const url = document.createElement("input");
    url.className = "link-url";
    url.type = "url";
    url.placeholder = "Add URL...";
    url.value = link.url;
    url.title = link.url;
    url.setAttribute("aria-label", `Link ${index + 1} URL`);
    url.hidden = link.type === "asset";

    const picker = document.createElement("button");
    picker.type = "button";
    picker.className = "asset-picker";
    picker.textContent = link.type === "asset" ? link.name || "Choose Asset..." : "Choose Asset...";
    picker.classList.toggle("is-placeholder", link.type !== "asset" || !link.name);
    picker.title = link.type === "asset" ? link.name || link.url : "Choose an Owlbear asset";
    picker.hidden = link.type !== "asset";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-link";
    remove.textContent = "×";
    remove.title = `Remove link ${index + 1}`;
    remove.setAttribute("aria-label", remove.title);

    const view = actionButton(EYE_ICON_SVG);
    const present = actionButton(CAST_ICON_SVG);
    let saveTimer: number | undefined;
    const updateActions = () => {
      const label = type.value;
      view.title = `View ${label} privately`;
      view.setAttribute("aria-label", view.title);
      present.title = `Present ${label} to players`;
      present.setAttribute("aria-label", present.title);
      view.disabled = present.disabled = !itemId || !url.value.trim() || type.value !== link.type;
    };
    updateActions();

    type.addEventListener("change", () => {
      const isAsset = type.value === "asset";
      url.hidden = isAsset;
      picker.hidden = !isAsset;
      if (isAsset) {
        if (link.type === "asset") url.value = link.url;
        picker.textContent = link.type === "asset" ? link.name || "Choose Asset..." : "Choose Asset...";
        picker.classList.toggle("is-placeholder", link.type !== "asset" || !link.name);
      } else if (link.type === "asset") {
        url.value = "";
        url.title = "";
      } else {
        link.type = type.value as ModalContentType;
        if (link.url.trim()) void saveLinks();
      }
      updateActions();
    });
    picker.addEventListener("click", async () => {
      try {
        const asset = await chooseAsset();
        if (!asset) return;
        link.type = "asset";
        link.url = asset.url;
        link.name = asset.name;
        url.value = asset.url;
        picker.textContent = asset.name;
        picker.classList.remove("is-placeholder");
        picker.title = asset.name;
        updateActions();
        updateAddButton();
        await saveLinks();
      } catch {
        saveStatus.textContent = "Asset picker failed";
      }
    });
    url.addEventListener("input", () => {
      link.type = type.value as ModalContentType;
      delete link.name;
      link.url = url.value;
      url.title = url.value;
      updateActions();
      updateAddButton();
      saveStatus.textContent = "Editing";
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => { void saveLinks(); }, 700);
    });
    url.addEventListener("change", () => {
      window.clearTimeout(saveTimer);
      void saveLinks();
    });
    url.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        url.blur();
      }
    });
    remove.addEventListener("click", () => {
      window.clearTimeout(saveTimer);
      links.splice(index, 1);
      renderRows();
      void saveLinks();
    });
    view.addEventListener("click", () => openLink(link, "private"));
    present.addEventListener("click", () => openLink(link, "present"));

    row.append(number, type, url, picker, remove, view, present);
    linkList.appendChild(row);
  });
}

function saveLinks(reportErrors = false): Promise<boolean> {
  if (!itemId) return Promise.resolve(false);
  const valid = reportErrors ? form.reportValidity() : form.checkValidity();
  if (!valid) {
    saveStatus.textContent = "Check URL";
    return Promise.resolve(false);
  }
  const saved = links
    .map((link) => ({ type: link.type, url: link.url.trim(), ...(link.type === "asset" ? { name: link.name } : {}) }))
    .filter((link) => link.url.length > 0)
    .slice(0, MAX_HANDOUT_LINKS);
  const id = itemId;
  const sequence = ++saveSequence;
  saveStatus.textContent = "Saving…";
  const write = saveQueue.catch(() => {}).then(async () => {
    await OBR.scene.items.updateItems([id], (items) => {
      for (const item of items) {
        if (saved.length) item.metadata[METADATA_KEY] = createHandoutMetadata(saved);
        else delete item.metadata[METADATA_KEY];
      }
    });
  });
  saveQueue = write;
  return write.then(
    () => {
      if (sequence === saveSequence) saveStatus.textContent = "Saved";
      return true;
    },
    () => {
      if (sequence === saveSequence) saveStatus.textContent = "Save failed";
      return false;
    },
  );
}

async function openLink(link: HandoutLink, action: "private" | "present") {
  const url = link.url.trim();
  const contentType = link.type;
  if (!url || !(await saveLinks(true))) return;
  if (action === "private") {
    await OBR.modal.open({
      id: VIEWER_MODAL_ID,
      url: `/viewer.html?${new URLSearchParams({ url, contentType, mode: "private" })}`,
      fullScreen: true,
      hidePaper: true,
      hideBackdrop: true,
    });
  } else {
    const message: ModalShowMessage = { id: crypto.randomUUID(), url, contentType, tokenName, assetName: link.name };
    await presentHandout(message);
  }
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") return;
  itemId = (await OBR.player.getSelection())?.[0];
  if (!itemId) return;
  const items = await OBR.scene.items.getItems<Item>([itemId]);
  if (items[0]) tokenName = displayName(items[0]);
  links = readHandoutLinks(items[0]?.metadata[METADATA_KEY]);
  if (!links.length) links.push({ type: "asset", url: "" });
  renderRows();
});

addButton.addEventListener("click", () => {
  if (addButton.disabled) return;
  links.push({ type: "asset", url: "" });
  renderRows();
  linkList.querySelectorAll<HTMLButtonElement>(".asset-picker").item(links.length - 1)?.focus();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveLinks(true);
});
