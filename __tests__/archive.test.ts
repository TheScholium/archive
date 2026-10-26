import {PAGE_OFFSET, captureLasso, saveCapture} from '../src/archive';
import {DEFAULT_SETTINGS} from '../src/storage';

const files: Map<string, any> = (global as any).__files;
const host = (global as any).__host;
const NOW = new Date(2026, 9, 24, 21, 36, 0);

describe('captureLasso', () => {
  it('uses the private folder first and reads notebook and page', async () => {
    const res = await captureLasso(NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.capture.previewPath).toBe('/data/plugin/archive/preview-20261024-213600.png');
    expect(res.capture.notebook).toBe('Lee Manifolds');
    expect(res.capture.page).toBe(host.page + PAGE_OFFSET);
  });

  it('falls back to EXPORT when the private folder fails', async () => {
    host.privateFails = true;
    const res = await captureLasso(NOW);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.capture.previewPath).toBe('/storage/emulated/0/EXPORT/Archive/preview-20261024-213600.png');
  });

  it('reports every attempt when the host fails', async () => {
    host.allFails = true;
    const res = await captureLasso(NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('/data/plugin/archive/preview-');
      expect(res.message).toContain('/storage/emulated/0/EXPORT/Archive/preview-');
    }
  });

  it('removes old previews from the private folder', async () => {
    files.set('/data/plugin/archive/preview-20200101-000000.png', {png: true});
    await captureLasso(NOW);
    expect(files.has('/data/plugin/archive/preview-20200101-000000.png')).toBe(false);
  });
});

describe('saveCapture', () => {
  const settings = {...DEFAULT_SETTINGS, inboxDir: '/storage/emulated/0/Document/Vault/Inbox'};

  it('copies the image and writes the note', async () => {
    const cap = await captureLasso(NOW);
    if (!cap.ok) throw new Error('capture failed');
    const res = await saveCapture(settings, cap.capture, 'Geodesic equation', NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.notePath).toBe('/storage/emulated/0/Document/Vault/Inbox/Geodesic equation.md');
    expect(res.imagePath).toBe('/storage/emulated/0/Document/Vault/Inbox/attachments/Geodesic equation 20261024-213600.png');
    expect(files.has(res.imagePath)).toBe(true);
    const md = String(files.get(res.notePath));
    expect(md).toContain('![[Geodesic equation 20261024-213600.png|ink]]');
    expect(md).toContain('notebook: "Lee Manifolds"');
    expect(md).toContain('page: 12');
    // the private preview is gone
    expect(files.has(cap.capture.previewPath)).toBe(false);
  });

  it('does not overwrite a note with the same title', async () => {
    const cap = await captureLasso(NOW);
    if (!cap.ok) throw new Error('capture failed');
    files.set(settings.inboxDir + '/Lemma.md', 'old');
    const res = await saveCapture(settings, cap.capture, 'Lemma', NOW);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.notePath).toBe(settings.inboxDir + '/Lemma 2.md');
    expect(files.get(settings.inboxDir + '/Lemma.md')).toBe('old');
  });

  it('reports a missing preview file', async () => {
    const res = await saveCapture(settings, {previewPath: '/data/plugin/archive/none.png', notebook: null, page: null}, 'X', NOW);
    expect(res.ok).toBe(false);
  });
});
