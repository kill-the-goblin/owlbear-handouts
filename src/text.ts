import type { TextTheme } from "./constants";

const loadedFonts = new Set<string>();
const htmlTags = new Set(["div", "span", "h1", "h2", "h3", "h4", "p", "br", "ul", "ol", "li", "em", "strong", "u"]);
const blockedTags = new Set(["script", "style", "template", "iframe", "object", "embed", "svg", "math", "form"]);

function loadGoogleFont(family: string, weight = 400): void {
  const key = `${family}:${weight}`;
  if (loadedFonts.has(key)) return;
  loadedFonts.add(key);
  const url = new URL("https://fonts.googleapis.com/css2");
  url.searchParams.set("family", weight === 400 ? family : `${family}:wght@${weight}`);
  url.searchParams.set("display", "swap");
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = url.toString();
  document.head.append(stylesheet);
}

function validColor(value: string): boolean {
  // CSSOM may serialize a valid hex or named color as rgb()/rgba().
  return (/^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/i.test(value)
    || /^[a-z]+$/i.test(value)
    || /^rgba?\([^()]+\)$/i.test(value))
    && CSS.supports("color", value);
}

function validSize(value: string): boolean {
  return /^(?:\d+(?:\.\d+)?|\.\d+)em$/.test(value)
    && Number.parseFloat(value) >= 0.5 && Number.parseFloat(value) <= 3;
}

function validFont(value: string): string | null {
  const family = value.trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  return /^[a-z\d][a-z\d ._-]{0,79}$/i.test(family) ? family : null;
}

function applyAllowedStyles(source: HTMLElement, target: HTMLElement, inheritedFont?: string, inheritedWeight = 400): { font?: string; weight: number } {
  const declarations = source.style;
  const color = declarations.getPropertyValue("color").trim();
  if (validColor(color)) target.style.color = color;

  const size = declarations.getPropertyValue("font-size").trim();
  if (validSize(size)) target.style.fontSize = size;

  let font = inheritedFont;
  const family = validFont(declarations.getPropertyValue("font-family"));
  if (family) {
    font = family;
    target.style.fontFamily = `"${family}", Georgia, serif`;
  }

  let weight = inheritedWeight;
  const weightValue = declarations.getPropertyValue("font-weight").trim();
  if (/^\d{3}$/.test(weightValue)) {
    const numericWeight = Number(weightValue);
    if (numericWeight >= 100 && numericWeight <= 900) {
      weight = numericWeight;
      target.style.fontWeight = weightValue;
    }
  }

  const fontStyle = declarations.getPropertyValue("font-style").trim();
  if (fontStyle === "italic" || fontStyle === "normal") target.style.fontStyle = fontStyle;

  const decoration = declarations.getPropertyValue("text-decoration").trim();
  if (decoration === "underline" || decoration === "none") target.style.textDecoration = decoration;

  const alignment = declarations.getPropertyValue("text-align").trim();
  if (["left", "center", "right"].includes(alignment)) target.style.textAlign = alignment;

  const lineHeight = declarations.getPropertyValue("line-height").trim();
  if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(lineHeight)) {
    const height = Number(lineHeight);
    if (height >= 1 && height <= 2.5) target.style.lineHeight = lineHeight;
  }

  if (font && font.toLowerCase() !== "georgia") {
    loadGoogleFont(font);
    if (weight !== 400) loadGoogleFont(font, weight);
  }
  return { font, weight };
}

function appendAllowedHtml(source: Node, target: Node, inheritedFont?: string, inheritedWeight = 400): void {
  if (source.nodeType === Node.TEXT_NODE) {
    target.appendChild(document.createTextNode(source.textContent ?? ""));
    return;
  }
  if (source.nodeType !== Node.ELEMENT_NODE) return;

  const element = source as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (blockedTags.has(tag)) return;
  if (!htmlTags.has(tag)) {
    for (const child of Array.from(element.childNodes)) appendAllowedHtml(child, target, inheritedFont, inheritedWeight);
    return;
  }

  const clean = document.createElement(tag);
  const defaultWeight = tag === "strong" || /^h[1-4]$/.test(tag) ? 700 : inheritedWeight;
  const styles = applyAllowedStyles(element, clean, inheritedFont, defaultWeight);
  target.appendChild(clean);
  for (const child of Array.from(element.childNodes)) appendAllowedHtml(child, clean, styles.font, styles.weight);
}

function renderAllowedHtml(block: HTMLElement, source: string): void {
  const parsed = new DOMParser().parseFromString(source, "text/html");
  for (const child of Array.from(parsed.body.childNodes)) appendAllowedHtml(child, block);
}

export function renderHandoutText(container: HTMLElement, source: string, theme: TextTheme = "dark"): void {
  container.replaceChildren();
  container.classList.add("text-mode");
  container.classList.toggle("light-text", theme === "light");
  const block = document.createElement("div");
  block.className = "text-handout";
  renderAllowedHtml(block, source);
  container.append(block);
}
