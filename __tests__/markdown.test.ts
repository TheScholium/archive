import {buildNote, isoLocal, notebookName, safeName, stamp, uniqueStem} from '../src/markdown';

describe('safeName', () => {
  it('keeps normal titles', () => {
    expect(safeName('Geodesic equation')).toBe('Geodesic equation');
  });
  it('replaces characters that Obsidian or Android reject', () => {
    expect(safeName('a/b:c*d?e"f<g>h|i#j^k[l]m')).toBe('a-b-c-d-e-f-g-h-i-j-k-l-m');
  });
  it('removes a .md ending, extra spaces and edge dots', () => {
    expect(safeName('  ..Lemma   2.1.md ')).toBe('Lemma 2.1');
  });
  it('falls back to Untitled', () => {
    expect(safeName('   ')).toBe('Untitled');
    expect(safeName('')).toBe('Untitled');
  });
  it('cuts long titles to 80 characters', () => {
    expect(safeName('x'.repeat(200)).length).toBe(80);
  });
});

describe('dates', () => {
  const d = new Date(2026, 9, 24, 21, 5, 9);
  it('stamp', () => expect(stamp(d)).toBe('20261024-210509'));
  it('isoLocal', () => expect(isoLocal(d)).toBe('2026-10-24T21:05'));
});

describe('notebookName', () => {
  it('strips folder and extension', () => {
    expect(notebookName('/storage/emulated/0/Note/Lee Manifolds.note')).toBe('Lee Manifolds');
  });
  it('returns null for nothing', () => {
    expect(notebookName('')).toBeNull();
    expect(notebookName(null)).toBeNull();
  });
});

describe('uniqueStem', () => {
  it('returns the stem when free', async () => {
    expect(await uniqueStem('A', '.md', async () => false)).toBe('A');
  });
  it('adds a number when taken', async () => {
    const taken = new Set(['A.md', 'A 2.md']);
    expect(await uniqueStem('A', '.md', async n => taken.has(n))).toBe('A 3');
  });
});

describe('buildNote', () => {
  it('writes properties and one embed', () => {
    const note = buildNote({image: 'T 20261024-210509.png', notebook: 'Lee "Manifolds"', page: 12, captured: new Date(2026, 9, 24, 21, 5)});
    expect(note).toBe(
      [
        '---',
        'captured: 2026-10-24T21:05',
        'source: supernote',
        'notebook: "Lee \\"Manifolds\\""',
        'page: 12',
        'tags:',
        '  - archive',
        '---',
        '',
        '![[T 20261024-210509.png|ink]]',
        '',
      ].join('\n'),
    );
  });
  it('leaves out the notebook and page when unknown', () => {
    const note = buildNote({image: 'x.png', notebook: null, page: null, captured: new Date(2026, 0, 2, 3, 4)});
    expect(note).not.toContain('notebook');
    expect(note).not.toContain('page:');
  });
});
