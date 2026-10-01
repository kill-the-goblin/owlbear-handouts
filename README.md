# Handouts

Handouts is an Owlbear Rodeo extension. It allows the GM/DM to attach up to three handouts to any token, choosing
Asset, Image, or Page for each. Each link can be opened either privately in a full-screen GM view or presented to players in a full-screen view. While presenting, the GM keeps the map visible and gets a small preview with a Dismiss button.
The preview defaults to 400 × 300 pixels at the bottom left. The GM can change its height and location in the Handouts settings panel; its width follows a 4:3 ratio. Both settings are saved per room.

## Scope

- Trigger: token context menu or Handouts settings panel (no click/hover triggers yet).
- Content: existing Owlbear image assets, direct image URLs, or iframe pages.
  Local files (`file://`) and Obsidian vault notes are not supported yet.

## Dev

```
npm install
npm run dev
```

This starts a Vite dev server (default `http://localhost:11207`). In Owlbear
Rodeo, go to Extensions -> Manage Extensions -> Add custom extension, and
point it at `http://localhost:11207/manifest.json`.

## Build

```
npm run build
```

Outputs static files to `dist/`, ready to deploy anywhere that serves static
files over HTTPS (Owlbear extensions must be served over HTTPS in production;
`localhost` is allowed for development).

## How it works

- `background.html` / `src/background.ts` - always-loaded hidden page.
  Registers metadata-filtered Handouts context-menu variants sized for the
  token's saved link count and handles broadcasts.
- `configure.html` / `src/configure.ts` - embedded Handouts menu (GM only) with
  Owlbear asset selection or typed URLs, private-view and present buttons, and automatic saving.
- `viewer.html` / `src/viewer.ts` - the actual modal content page opened via
  `OBR.modal.open`. Renders an `<img>` or `<iframe>`. A private GM viewer has
  a local close button; a player viewer is controlled by the GM.
- `preview.html` / `src/preview.ts` - compact GM preview shown during a player
  presentation, with the shared Dismiss button.
