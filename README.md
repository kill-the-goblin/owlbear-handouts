# Handouts

Handouts is an Owlbear Rodeo extension for keeping a named, searchable list of handouts in each scene. The GM can privately view a handout or present it full-screen to players. During a presentation, the GM keeps the map visible and gets a small preview with a Dismiss button. Players joining mid-presentation see the active handout.

Handouts can use an existing Owlbear Rodeo image asset, an external URL, or text. Image URLs render as images; other URLs render as iframe pages. Some websites prevent embedding. Local files and Obsidian vault notes are not supported.

Text handouts default to 40 px white serif text centered 30 px above the midpoint on black (about 14 px in the default GM preview, shifted up about 10 px; both scale with preview width). In the expanded handout row, choose **Text**, enter up to 3,000 characters, and use the small controls beside the editor to choose Dark or Light (black text on white).

Text handouts accept a limited HTML format. Supported tags are `div`, `span`, `h1`–`h4`, `p`, `br`, `ul`, `ol`, `li`, `em`, `strong`, and `u`. The default heading sizes are 1.5em, 1.3em, 1.1em, and 1em (60, 52, 44, and 40 px in the player viewer). The `style` attribute accepts only `color` (CSS name, hex, or RGB), `font-size` (0.5–3em), `font-family` (one Google Fonts family name), `font-weight` (numeric 100–900), `font-style` (`italic` or `normal`), `text-decoration` (`underline` or `none`), `text-align` (`left`, `center`, or `right`), and `line-height` (unitless 1–2.5). Styles on a wrapping `div` apply throughout the handout unless a child overrides them. Other tags and attributes are discarded. For example:

```html
<div style="color:#6B8EAD; font-family:'IM Fell English SC'">
  <h1>Harbormaster's Notice</h1>
  <p>All vessels must return before dusk.</p>
  <ol style="text-align:left; line-height:1.8">
    <li>Report to the dockmaster.</li>
    <li><strong style="color:green">No exceptions.</strong></li>
  </ol>
  <p style="font-family:Georgia">A note in another hand.</p>
</div>
```

Use `p` or `br` for line breaks. Text without tags follows normal HTML whitespace rules; pipes and the earlier directives have no special meaning.

The preview defaults to 400 × 300 pixels at the bottom left. The GM can change its height and location in the Handouts panel; these settings are saved per room.

## Use

Open Handouts from Owlbear's extension action. Choose **+ Add Handout**, click its name to rename it, and choose an **Asset**, **Link**, or **Text** handout. Search filters the scene list by name. Use the eye icon to view privately or the present icon to show it to players. While presenting, use the arrows at the bottom right to move through handouts with content in the scene's saved order. The arrows stop at the first and last handout; the stop button between them dismisses the presentation.

Existing token handouts are copied into the scene list once, when that scene is first opened with this version. The old token metadata is left intact as a backup. Each scene has its own list.

Use **Export** to download the current scene's handouts as JSON. Open another scene (in this room or another room), choose **Import**, and select that file. **Append** adds copies to the destination list; **Replace all** overwrites its list. Import creates new handout IDs and leaves the source scene unchanged. If transferring between Owlbear accounts, check that the destination account can access any referenced Owlbear assets.

## Development

```
npm install
npm run dev
```

This starts Vite at `http://localhost:11207`. In Owlbear Rodeo, add `http://localhost:11207/manifest.json` as a custom extension.

Local development versions use a SemVer prerelease suffix such as `0.7.0-dev.1` in `package.json`, `package-lock.json`, and `public/manifest.json`. Remove the suffix for the production release (`0.7.0`) before pushing the deployment branch.

```
npm run build
```

This produces the static extension in `dist/`. Production hosting must use HTTPS.

## Code

- `src/settings.ts` manages scene handouts, search, asset selection, private viewing, and presentation.
- `src/background.ts` synchronizes the active presentation through room metadata, including for late joiners.
- `src/viewer.ts` renders images, web pages, or text in the full-screen viewer.
- `src/preview.ts` renders the GM preview and Dismiss control.
