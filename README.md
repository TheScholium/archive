# Archive

**Send handwriting from your Supernote to Obsidian.**

I've often found that I want more control over what exactly shows up in Obsidian, as opposed to mirroring whole notebooks or pages. Archive allows you to lasso a derivation, a diagram, a sentence you want to come back to, tap **Send to Obsidian**, type a title, and create its own note in your vault, with the handwriting at the top and room to type under it.

Archive saves your handwriting as an image. It does not convert it to text.

## Install

1. Download `archive.snplg` from the [latest release](https://github.com/TheScholium/archive/releases/latest).
2. Copy it to your Supernote (USB, Supernote Partner, or your usual cloud folder).
3. On the device, open **Settings > Apps > Plugins**, add the file, and turn Archive on.

Archive needs firmware **Chauvet 3.30.45 or later**, the first version with plugins. It is not in Supernote's InkHub catalog.

## Use

1. Lasso a section on a note page.
2. Tap **Send to Obsidian** in the lasso bar.
3. Type a title.
4. Tap **Save**.

Archive writes two files to its folder on the Supernote, `Document/Archive`:

```
Document/Archive/Title.md
Document/Archive/attachments/Title 20261024-213600.png
```

The note looks like this:

```markdown
---
captured: 2026-10-24T21:36
source: supernote
notebook: "Lee Manifolds"
page: 12
tags:
  - archive
---

![[Title 20261024-213600.png|ink]]
```

If a note with that title already exists, Archive adds a number ("Title 2"). It never overwrites a note.

## Getting the notes into your vault

Archive only writes to a folder on the Supernote. Your job is to get that folder into your vault. Any method that copies `Document/Archive` to your computer and into your vault works. Options I'm aware of:

- **Supernote Partner.** Sync the device with the Partner app on your computer, then make the synced `Archive` folder part of your vault. (This is what I did)
- **Google Drive or Dropbox.** Sync the Supernote to the service, and keep your vault, or the `Archive` folder inside it, in the synced folder on your computer.
- **A symlink.** If the synced `Archive` folder is outside your vault, link it in. On a Mac, in Terminal: `ln -s "/path/to/synced/Archive" "/path/to/your/vault/Archive"`. A Finder alias does not work.

The notes and their images stay together: each note's image is in `attachments` beside it. If you move a note in Obsidian, move its image too, or let Obsidian do it for you.

To send the notes somewhere else, change the **inbox folder** under **Settings > Apps > Plugins > Archive**.

## Dark themes

Handwriting is black strokes on a transparent background, so on a dark theme it disappears. Archive marks every image it embeds with `|ink` so that a theme can recolor it.

My theme, **[Istari](https://github.com/TheScholium/istari)**, recolors ink images to its text color. Nothing to set up.
**Any other theme:** add this CSS snippet (Settings > Appearance > CSS snippets). It draws the strokes white in dark mode and leaves them black in light mode and in PDF exports.

```css
.theme-dark img[alt~="ink"] { filter: invert(1); }
@media print { img[alt~="ink"] { filter: none; } }
```

## Good to know

- Archive asks for one permission, `FILE:WRITE`. It does not read or delete your files, and it makes no network requests.
- Tested on the Supernote Nomad with Chauvet 3.31.45. It should work on the Manta too, but nobody has tried it yet. If you do, please say so in an issue.
- The `page` property comes from the device, counted from 1. I have not checked it on every kind of notebook. If it is off by one, please open an issue.
- To change the note template, edit `buildNote` in `src/markdown.ts` and build the plugin yourself.

## Building it yourself

Needs Node 18 or later, a JDK (17 works) and `zip`.

```bash
npm install
npm run typecheck
npm test
npm run build      # writes build/outputs/archive.snplg
```

Every push to `main` builds the plugin on GitHub. A version tag (`v1.1.0`) also publishes a release with `archive.snplg` attached.

| Path | Purpose |
| --- | --- |
| `index.js` | Plugin entry. Lasso button, settings button, life cycle. |
| `App.tsx` | Title screen and settings screen. |
| `src/archive.ts` | `captureLasso` and `saveCapture`. |
| `src/markdown.ts` | File names, dates and the note template. No React Native imports. |
| `src/storage.ts` | Permission, file calls, settings. |
| `android/.../ArchiveFilesModule.java` | Native file module (write text, copy file). |

## License

[MIT](LICENSE). Made by [The Scholium](https://github.com/TheScholium), who also makes [Mathdown](https://github.com/TheScholium/mathdown) (Markdown and LaTeX on the Supernote) and [Istari](https://github.com/TheScholium/istari), a theme for Obsidian. The native file module and the build script come from Mathdown.
