/* Test doubles for the Supernote host: an in-memory file system behind the
 * ArchiveFiles native module, and a mock sn-plugin-lib. */
const {NativeModules} = require('react-native');

const files = new Map(); // path -> string (text) or {png: true}
global.__files = files;
global.__host = {privateFails: false, allFails: false, closed: 0, dialogs: [], page: 11, file: '/storage/emulated/0/Note/Lee Manifolds.note'};

function under(dir) {
  return [...files.keys()].filter(k => k.startsWith(dir + '/'));
}

NativeModules.ArchiveFiles = {
  version: jest.fn(async () => '1.0.0'),
  readText: jest.fn(async p => {
    if (!files.has(p)) throw new Error('ENOENT ' + p);
    return files.get(p);
  }),
  writeText: jest.fn(async (p, t) => {
    files.set(p, t);
    return true;
  }),
  exists: jest.fn(async p => files.has(p) || under(p).length > 0),
  mkdirs: jest.fn(async () => true),
  listDir: jest.fn(async d => {
    const out = new Map();
    for (const k of under(d)) {
      const name = k.slice(d.length + 1).split('/')[0];
      out.set(name, {name, path: d + '/' + name, isDir: k.slice(d.length + 1).includes('/')});
    }
    return [...out.values()];
  }),
  copyFile: jest.fn(async (from, to) => {
    if (!files.has(from)) throw new Error('ENOENT ' + from);
    files.set(to, files.get(from));
    return true;
  }),
  deleteFile: jest.fn(async p => {
    files.delete(p);
    return true;
  }),
};

jest.mock('sn-plugin-lib', () => ({
  PluginManager: {
    init: jest.fn(),
    getPluginDirPath: jest.fn(async () => '/data/plugin/archive'),
    hasPermission: jest.fn(async () => 1),
    requestPermission: jest.fn(async () => 1),
    closePluginView: jest.fn(async () => {
      global.__host.closed++;
      return true;
    }),
    showPluginView: jest.fn(async () => true),
  },
  PluginCommAPI: {
    generateLassoPreview: jest.fn(async path => {
      const h = global.__host;
      const shared = path.startsWith('/storage/');
      if (h.allFails || (h.privateFails && !shared)) return {success: false, error: {code: 5, message: 'cannot write ' + path}};
      global.__files.set(path, {png: true});
      return {success: true, result: {imagePath: path, rect: {left: 0, top: 0, right: 10, bottom: 10}, rotateDegree: 0}};
    }),
    getCurrentFilePath: jest.fn(async () => ({success: true, result: global.__host.file})),
    getCurrentPageNum: jest.fn(async () => ({success: true, result: global.__host.page})),
  },
  NativeUIUtils: {
    showRattaDialog: jest.fn((msg) => {
      global.__host.dialogs.push(msg);
      return Promise.resolve(true);
    }),
  },
}));

beforeEach(() => {
  files.clear();
  global.__host.privateFails = false;
  global.__host.allFails = false;
  global.__host.closed = 0;
  global.__host.dialogs = [];
});
