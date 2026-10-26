/**
 * Pure text helpers: file names, the note template, date stamps.
 * No React Native imports, so the tests run in plain Node.
 */

/** Characters that Obsidian or Android do not allow in a note name. */
const BAD_NAME_CHARS = /[\\/:*?"<>|#^[\]\u0000-\u001f]/g;

/** Makes a safe note name from the title that the user typed. */
export function safeName(title: string): string {
  const t = String(title || '')
    .trim()
    .replace(/\.(md|markdown|txt)$/i, '')
    .replace(BAD_NAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '');
  return (t || 'Untitled').slice(0, 80);
}

function pad(n: number, width = 2): string {
  let s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}

/** 20261024-213600 (local time). Used in image file names. */
export function stamp(d: Date): string {
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/** 2026-10-24T21:36 (local time, no zone). Used in the note properties. */
export function isoLocal(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/** "/storage/.../Notebook 1.note" -> "Notebook 1". */
export function notebookName(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = String(path).split('/').pop() || '';
  const name = base.replace(/\.(note|pdf|epub|mark)$/i, '').trim();
  return name || null;
}

/**
 * Finds a name that is not taken yet: "Title", then "Title 2", "Title 3", ...
 * `taken` gets the full file name (stem + extension).
 */
export async function uniqueStem(stem: string, ext: string, taken: (fileName: string) => Promise<boolean>): Promise<string> {
  if (!(await taken(stem + ext))) return stem;
  for (let i = 2; i < 200; i++) {
    const candidate = stem + ' ' + i;
    if (!(await taken(candidate + ext))) return candidate;
  }
  return stem + ' ' + Date.now();
}

export type NoteInfo = {
  /** File name of the PNG, as Obsidian must find it (no folder). */
  image: string;
  notebook: string | null;
  /** Page number as the person sees it on the device (first page = 1). */
  page: number | null;
  captured: Date;
};

/** A double-quoted YAML string. JSON strings are valid YAML for all text we write. */
function yamlString(s: string): string {
  return JSON.stringify(s);
}

/**
 * The text of the new note. Change this one function to change the template.
 *
 * The properties are plain Obsidian properties. The body is one embed of the
 * lasso image, so that the note opens with the handwriting visible and the
 * person can type under it.
 *
 * The embed carries the alias "ink" (![[image.png|ink]]). The strokes are
 * black on a transparent background and disappear on a dark theme; themes and
 * CSS snippets can recolor images with alt="ink". The Istari theme does this.
 */
export function buildNote(info: NoteInfo): string {
  const lines = ['---', 'captured: ' + isoLocal(info.captured), 'source: supernote'];
  if (info.notebook) lines.push('notebook: ' + yamlString(info.notebook));
  if (info.page !== null && info.page !== undefined) lines.push('page: ' + info.page);
  lines.push('tags:', '  - archive', '---', '', '![[' + info.image + '|ink]]', '');
  return lines.join('\n');
}
