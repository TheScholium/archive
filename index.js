/**
 * Plugin entry: initialisation, buttons and life-cycle events.
 *
 * Buttons
 *  - id 100, lasso toolbar (NOTE): "Send to Obsidian". Takes a PNG of the
 *    lasso selection, then opens the title screen.
 *  - config button (Settings > Apps > Plugins): opens the settings.
 */
import {AppRegistry, Image} from 'react-native';
import {NativeUIUtils, PluginManager} from 'sn-plugin-lib';
import App from './App';
import {name as appName} from './app.json';
import {captureLasso, session} from './src/archive';
import {emit} from './src/bus';
import {resetPermissionCache} from './src/storage';

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

const icon = Image.resolveAssetSource(require('./assets/icon.png')).uri;

// Edit data types: 0 strokes, 1 title, 2 image, 3 text, 4 link, 5 geometry.
// The button shows for any selection that holds one of these.
PluginManager.registerButton(2, ['NOTE'], {
  id: 100,
  name: 'Send to Obsidian',
  icon,
  editDataTypes: [0, 1, 2, 3, 4, 5],
  showType: 0,
});

let busy = false;

function say(msg, ok) {
  try {
    NativeUIUtils.showRattaDialog(msg, '', 'OK', ok);
  } catch {
    // no dialog available
  }
}

PluginManager.registerButtonListener({
  onButtonPress: async event => {
    if (event.id !== 100 || busy) return;
    busy = true;
    try {
      const res = await captureLasso();
      if (!res.ok) {
        say(res.message, false);
        return;
      }
      session.capture = res.capture;
      session.wantSettings = false;
      emit('capture');
      await PluginManager.showPluginView();
    } finally {
      busy = false;
    }
  },
});

PluginManager.registerConfigButton()
  .then(() => {
    PluginManager.registerConfigButtonListener({
      onClick: () => {
        session.wantSettings = true;
        emit('open-settings');
        PluginManager.showPluginView();
      },
    });
  })
  .catch(() => {});

PluginManager.registerPluginLifeListener({
  onMsg: msg => {
    const state = msg && msg.state;
    if (state === 2) emit('ui-shown');
    if (state === 3 || state === 4) {
      emit('ui-hidden');
      // "Allow this time only" ends with the session; ask again next time.
      resetPermissionCache();
    }
  },
});
