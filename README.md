# Handouts

Handouts is an Owlbear Rodeo extension for keeping a named, searchable list of handouts in each scene. The GM can privately view a handout or present it full-screen to players. During a presentation, the GM keeps the map visible and gets a small preview with a Dismiss button. Players joining mid-presentation see the active handout.

Handouts can use an existing Owlbear Rodeo image asset or an external URL. Image URLs render as images; other URLs render as iframe pages. Some websites prevent embedding. Local files and Obsidian vault notes are not supported.

The preview defaults to 400 × 300 pixels at the bottom left. The GM can change its height and location in the Handouts panel; these settings are saved per room.

## Use

Open Handouts from Owlbear's extension action. Choose **+ Add Handout**, click its name to rename it, and choose an **Asset** or **Link**. Search filters the scene list by name. Use the eye icon to view privately or the present icon to show it to players.

Existing token handouts are copied into the scene list once, when that scene is first opened with this version. The old token metadata is left intact as a backup. Each scene has its own list.

## Development

```
npm install
npm run dev
```

This starts Vite at `http://localhost:11207`. In Owlbear Rodeo, add `http://localhost:11207/manifest.json` as a custom extension.

```
npm run build
```

This produces the static extension in `dist/`. Production hosting must use HTTPS.

## Code

- `src/settings.ts` manages scene handouts, search, asset selection, private viewing, and presentation.
- `src/background.ts` synchronizes the active presentation through room metadata, including for late joiners.
- `src/viewer.ts` renders images or web pages in the full-screen viewer.
- `src/preview.ts` renders the GM preview and Dismiss control.
