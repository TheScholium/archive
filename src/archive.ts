/**
 * The two steps of the plugin:
 *
 *  1. captureLasso: ask the host for a PNG of the lasso selection and note
 *     the notebook name and page number.
 *  2. saveCapture: copy the PNG into the inbox folder and write the note.
 *
 * The title screen sits between the two steps (App.tsx).
 */
import {PluginCommAPI} from 'sn-plugin-lib';
import {NoteInfo, buildNote, notebookName, safeName, stamp, uniqueStem} from './markdown';
import {
  EXPORT_DIR,
  IMAGES_FOLDER,
  Settings,
  copyFile,
  deletePrivate,
  exists,
  getPrivateDir,
  isShared,
  listNames,
  mkdirs,
  writeText,
} from './storage';

/**
 * The host counts pages from 0 in jumpToPage. The person sees page 1 first.
 * If the "page" property in a new note is one too low or too high, change this number.
 */
export const PAGE_OFFSET = 1;

export type Capture = {
  /** The PNG that the host made. It lives in the plugin's private folder when possible. */
  previewPath: string;
  notebook: string | null;
  page: number | null;
};

export type CaptureResult = {ok: true; capture: Capture} | {ok: false; message: string};
export type SaveResult = {ok: true; notePath: string; imagePath: string} | {ok: false; message: string};

/** What the title screen shows when the plugin was opened from the lasso button. */
export const session: {capture: Capture | null; wantSettings: boolean} = {capture: null, wantSettings: false};

function errText(e: any): string {
  return String(e && e.message ? e.message : e);
}

async function clearOldPreviews(dir: string | null) {
  if (!dir) return;
  for (const name of await listNames(dir)) {
    if (/^preview-.*\.png$/.test(name)) await deletePrivate(dir + '/' + name);
  }
}

async function readMeta(): Promise<{notebook: string | null; page: number | null}> {
  let notebook: string | null = null;
  let page: number | null = null;
  try {
    const f: any = await PluginCommAPI.getCurrentFilePath();
    if (f && f.success) notebook = notebookName(String(f.result || ''));
  } catch {
    // the note still saves without a notebook name
  }
  try {
    const n: any = await PluginCommAPI.getCurrentPageNum();
    if (n && n.success && typeof n.result === 'number') page = n.result + PAGE_OFFSET;
  } catch {
    // the note still saves without a page number
  }
  return {notebook, page};
}

/**
 * Asks the host for a PNG of the current lasso selection.
 * Tries the plugin's private folder first (no permission needed), then EXPORT.
 */
export async function captureLasso(now: Date = new Date()): Promise<CaptureResult> {
  const dir = await getPrivateDir();
  await clearOldPreviews(dir);
  const file = 'preview-' + stamp(now) + '.png';
  const candidates: string[] = [];
  if (dir) candidates.push(dir + '/' + file);
  candidates.push(EXPORT_DIR + '/' + file);
  const errors: string[] = [];
  for (const path of candidates) {
    if (isShared(path) && !(await mkdirs(EXPORT_DIR))) {
      errors.push(path + ': no permission to write there');
      continue;
    }
    try {
      const res: any = await PluginCommAPI.generateLassoPreview(path);
      if (res && res.success) {
        const out = String((res.result && res.result.imagePath) || path);
        if (await exists(out)) {
          const meta = await readMeta();
          return {ok: true, capture: {previewPath: out, ...meta}};
        }
        errors.push(path + ': the host reported success, but there is no file');
      } else {
        errors.push(path + ': ' + ((res && res.error && res.error.message) || 'unknown error'));
      }
    } catch (e) {
      errors.push(path + ': ' + errText(e));
    }
  }
  return {ok: false, message: 'Archive could not read the lasso image.\n' + errors.join('\n')};
}

/** Copies the PNG into <inbox>/attachments and writes <inbox>/<Title>.md. */
export async function saveCapture(settings: Settings, capture: Capture, title: string, now: Date = new Date()): Promise<SaveResult> {
  const inbox = settings.inboxDir.replace(/\/+$/, '');
  const imagesDir = inbox + '/' + IMAGES_FOLDER;
  try {
    if (!(await mkdirs(inbox)) || !(await mkdirs(imagesDir))) {
      return {ok: false, message: 'Cannot create ' + imagesDir + ' (write permission?).'};
    }
    const stem = await uniqueStem(safeName(title), '.md', name => exists(inbox + '/' + name));
    const imageName = stem + ' ' + stamp(now) + '.png';
    const imagePath = imagesDir + '/' + imageName;
    const notePath = inbox + '/' + stem + '.md';
    await copyFile(capture.previewPath, imagePath);
    const info: NoteInfo = {image: imageName, notebook: capture.notebook, page: capture.page, captured: now};
    try {
      await writeText(notePath, buildNote(info));
    } catch (e) {
      return {ok: false, message: 'The image is saved at ' + imagePath + ', but the note failed: ' + errText(e)};
    }
    await deletePrivate(capture.previewPath);
    return {ok: true, notePath, imagePath};
  } catch (e) {
    return {ok: false, message: errText(e)};
  }
}
