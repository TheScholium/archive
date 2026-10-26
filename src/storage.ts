/**
 * Files, the write permission and the settings.
 *
 * sn-plugin-lib has no call that writes text or copies a file, so the plugin
 * has a small native module (android/.../ArchiveFilesModule.java).
 * Shared storage (Document, EXPORT) needs the Supernote permission
 * plugin.permission.FILE:WRITE. The plugin's private folder needs none.
 */
import {NativeModules, TurboModuleRegistry} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

export const STORAGE_ROOT = '/storage/emulated/0';
export const DEFAULT_INBOX = STORAGE_ROOT + '/Document/Archive';
export const EXPORT_DIR = STORAGE_ROOT + '/EXPORT/Archive';
/** Sub-folder of the inbox that holds the PNG files. */
export const IMAGES_FOLDER = 'attachments';

type NativeFiles = {
  version(): Promise<string>;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  mkdirs(path: string): Promise<boolean>;
  listDir(path: string): Promise<{name: string; path: string; isDir: boolean}[]>;
  copyFile(from: string, to: string): Promise<boolean>;
  deleteFile(path: string): Promise<boolean>;
};

function nativeFiles(): NativeFiles | null {
  const m = (NativeModules as any).ArchiveFiles;
  if (m) return m as NativeFiles;
  try {
    return (TurboModuleRegistry.get('ArchiveFiles') as any) || null;
  } catch {
    return null;
  }
}

export class FileError extends Error {}

function need(): NativeFiles {
  const m = nativeFiles();
  if (!m) throw new FileError('The Archive file module is not loaded. Install the plugin package again.');
  return m;
}

/* ------------------------------------------------------------------ */
/* Permission                                                          */
/* ------------------------------------------------------------------ */

let writeGranted = false;

/** Checks the write permission and asks for it when the plugin has none. */
export async function ensureWrite(): Promise<boolean> {
  if (writeGranted) return true;
  const name = 'plugin.permission.FILE:WRITE';
  try {
    if ((await PluginManager.hasPermission(name)) === 1) {
      writeGranted = true;
      return true;
    }
    const res = await PluginManager.requestPermission(name, 'Archive saves the lasso image and a Markdown note in your Obsidian inbox folder.');
    writeGranted = res === 1 || res === 2;
    return writeGranted;
  } catch {
    // Older firmware without a permission system: try the write anyway.
    return true;
  }
}

/** "Allow this time only" ends with the session, so ask again next time. */
export function resetPermissionCache() {
  writeGranted = false;
}

export function isShared(path: string): boolean {
  return path.startsWith('/storage/') || path.startsWith('/sdcard') || path.startsWith('/mnt/');
}

/* ------------------------------------------------------------------ */
/* File operations                                                     */
/* ------------------------------------------------------------------ */

export async function exists(path: string): Promise<boolean> {
  const m = nativeFiles();
  return m ? m.exists(path) : false;
}

export async function mkdirs(path: string): Promise<boolean> {
  if (isShared(path) && !(await ensureWrite())) return false;
  return need().mkdirs(path);
}

export async function writeText(path: string, text: string): Promise<void> {
  if (isShared(path) && !(await ensureWrite())) throw new FileError('Write permission was not given.');
  await need().writeText(path, text);
}

export async function copyFile(from: string, to: string): Promise<void> {
  if (isShared(to) && !(await ensureWrite())) throw new FileError('Write permission was not given.');
  const ok = await need().copyFile(from, to);
  if (!ok) throw new FileError('The copy is incomplete: ' + to);
}

/** Deletes a file in the plugin's private folder. Never throws. Never touches shared storage. */
export async function deletePrivate(path: string): Promise<void> {
  if (isShared(path)) return;
  try {
    await nativeFiles()?.deleteFile(path);
  } catch {
    // a stale preview does no harm
  }
}

export async function listNames(dir: string): Promise<string[]> {
  try {
    const m = nativeFiles();
    return m ? ((await m.listDir(dir)) || []).map(e => e.name) : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Settings (plugin private folder)                                    */
/* ------------------------------------------------------------------ */

export type Settings = {
  /** Folder that receives the new notes. Point it at a folder inside the Obsidian vault. */
  inboxDir: string;
};

export const DEFAULT_SETTINGS: Settings = {inboxDir: DEFAULT_INBOX};

let privateDirCache: string | null = null;

export async function getPrivateDir(): Promise<string | null> {
  if (privateDirCache) return privateDirCache;
  try {
    const d = await PluginManager.getPluginDirPath();
    if (d) privateDirCache = String(d).replace(/\/+$/, '');
  } catch {
    privateDirCache = null;
  }
  return privateDirCache;
}

export async function loadSettings(): Promise<Settings> {
  const dir = await getPrivateDir();
  const m = nativeFiles();
  if (!dir || !m) return {...DEFAULT_SETTINGS};
  try {
    const file = dir + '/settings.json';
    if (!(await m.exists(file))) return {...DEFAULT_SETTINGS};
    const s = JSON.parse(await m.readText(file));
    const inbox = typeof s.inboxDir === 'string' && s.inboxDir.trim() ? s.inboxDir.trim().replace(/\/+$/, '') : DEFAULT_INBOX;
    return {inboxDir: inbox};
  } catch {
    return {...DEFAULT_SETTINGS};
  }
}

export async function saveSettings(s: Settings): Promise<boolean> {
  const dir = await getPrivateDir();
  const m = nativeFiles();
  if (!dir || !m) return false;
  try {
    await m.writeText(dir + '/settings.json', JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
