/**
 * Archive: the title screen and the settings screen.
 *
 * The title screen opens after the lasso button took a PNG of the selection.
 * The person types a title, taps Save, and the plugin writes the note.
 * No decoration: one image, one text box, two buttons.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {Image, Keyboard, Pressable, ScrollView, StatusBar, Text, TextInput, View} from 'react-native';
import {NativeUIUtils, PluginManager} from 'sn-plugin-lib';
import {Capture, saveCapture, session} from './src/archive';
import {on} from './src/bus';
import {safeName} from './src/markdown';
import {DEFAULT_INBOX, DEFAULT_SETTINGS, Settings, loadSettings, saveSettings} from './src/storage';

// Istari paper palette (print colors): dark ink on white, gold accents.
const INK = '#221d16';
const MUTED = '#554c3e';
const GOLD = '#7d6224';
const RULE = '#d4cbb8';
const WARN = 'rgb(150, 66, 52)';
const PAPER = '#ffffff';
const SERIF = 'serif';

function Btn(props: {label: string; onPress: () => void; cta?: boolean; disabled?: boolean}) {
  const {label, onPress, cta, disabled} = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => ({
        minHeight: 48,
        minWidth: 120,
        paddingHorizontal: 18,
        marginLeft: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: disabled ? RULE : GOLD,
        backgroundColor: cta && !disabled ? GOLD : pressed ? '#f6f1e4' : PAPER,
      })}>
      <Text style={{fontFamily: SERIF, fontSize: 19, color: disabled ? '#857b69' : cta ? PAPER : GOLD}}>{label}</Text>
    </Pressable>
  );
}

function sayDone(msg: string, ok: boolean) {
  try {
    NativeUIUtils.showRattaDialog(msg, '', 'OK', ok);
  } catch {
    // no dialog available
  }
}

function App(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [capture, setCapture] = useState<Capture | null>(session.capture);
  const [screen, setScreen] = useState<'title' | 'settings'>(session.wantSettings ? 'settings' : 'title');
  const [title, setTitle] = useState('');
  const [inbox, setInbox] = useState(DEFAULT_INBOX);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSettings().then(s => {
      setSettings(s);
      setInbox(s.inboxDir);
    });
  }, []);

  // Read what the plugin entry stored, now and each time the view is shown.
  useEffect(() => {
    const sync = () => {
      setCapture(session.capture);
      if (session.wantSettings) setScreen('settings');
      else if (session.capture) setScreen('title');
    };
    const offs = [
      on('capture', () => {
        setTitle('');
        setError('');
        sync();
      }),
      on('open-settings', sync),
      on('ui-shown', sync),
    ];
    return () => offs.forEach(off => off());
  }, []);

  const close = useCallback(() => {
    Keyboard.dismiss();
    PluginManager.closePluginView().catch(() => {});
  }, []);

  const cancel = useCallback(() => {
    session.capture = null;
    session.wantSettings = false;
    setCapture(null);
    setTitle('');
    setError('');
    close();
  }, [close]);

  const save = useCallback(async () => {
    if (!capture || busy || !title.trim()) return;
    setBusy(true);
    setError('');
    const res = await saveCapture(settings, capture, title);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    session.capture = null;
    setCapture(null);
    setTitle('');
    close();
    sayDone('Saved ' + res.notePath.split('/').pop() + '\nin ' + settings.inboxDir, true);
  }, [capture, busy, title, settings, close]);

  const saveInbox = useCallback(async () => {
    const dir = inbox.trim().replace(/\/+$/, '') || DEFAULT_INBOX;
    const next = {...settings, inboxDir: dir};
    const ok = await saveSettings(next);
    if (!ok) {
      setError('The settings could not be saved.');
      return;
    }
    setSettings(next);
    setInbox(dir);
    session.wantSettings = false;
    setScreen('title');
    close();
  }, [inbox, settings, close]);

  const header = (text: string) => (
    <View style={{borderBottomWidth: 1, borderBottomColor: GOLD, paddingBottom: 6, marginBottom: 14}}>
      <Text style={{fontFamily: SERIF, fontSize: 26, color: INK}}>{text}</Text>
    </View>
  );

  const errorBox = error ? <Text style={{fontFamily: SERIF, fontSize: 16, color: WARN, marginTop: 10}}>{error}</Text> : null;

  if (screen === 'settings') {
    return (
      <View style={{flex: 1, backgroundColor: PAPER, padding: 18}}>
        <StatusBar hidden />
        {header('Archive settings')}
        <Text style={{fontFamily: SERIF, fontSize: 17, color: MUTED, marginBottom: 6}}>
          Inbox folder. New notes go here. Images go to its "attachments" folder. Use a folder inside your Obsidian vault.
        </Text>
        <TextInput
          value={inbox}
          onChangeText={setInbox}
          autoCapitalize="none"
          autoCorrect={false}
          style={{fontFamily: SERIF, fontSize: 18, color: INK, borderWidth: 1, borderColor: RULE, padding: 10}}
        />
        {errorBox}
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16}}>
          <Btn label="Close" onPress={cancel} />
          <Btn label="Save" cta onPress={saveInbox} />
        </View>
      </View>
    );
  }

  if (!capture) {
    return (
      <View style={{flex: 1, backgroundColor: PAPER, padding: 18}}>
        <StatusBar hidden />
        {header('Archive')}
        <Text style={{fontFamily: SERIF, fontSize: 18, color: MUTED}}>
          Lasso a section on a note page, then tap "Send to Obsidian" in the lasso bar.
        </Text>
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16}}>
          <Btn label="Close" onPress={cancel} />
        </View>
      </View>
    );
  }

  const stem = safeName(title);
  return (
    <ScrollView style={{flex: 1, backgroundColor: PAPER}} contentContainerStyle={{padding: 18}} keyboardShouldPersistTaps="handled">
      <StatusBar hidden />
      {header('Send to Obsidian')}
      <Image
        source={{uri: 'file://' + capture.previewPath}}
        resizeMode="contain"
        style={{width: '100%', height: 260, borderWidth: 1, borderColor: RULE, backgroundColor: PAPER}}
      />
      <Text style={{fontFamily: SERIF, fontSize: 15, color: MUTED, marginTop: 6}}>
        {[capture.notebook, capture.page !== null ? 'page ' + capture.page : null].filter(Boolean).join(', ')}
      </Text>
      <Text style={{fontFamily: SERIF, fontSize: 17, color: MUTED, marginTop: 14, marginBottom: 6}}>Title of the new note</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        autoFocus
        autoCorrect={false}
        onSubmitEditing={save}
        returnKeyType="done"
        placeholder="Title"
        placeholderTextColor="#857b69"
        style={{fontFamily: SERIF, fontSize: 22, color: INK, borderWidth: 1, borderColor: GOLD, padding: 10}}
      />
      {title.trim() ? (
        <Text style={{fontFamily: SERIF, fontSize: 15, color: MUTED, marginTop: 6}}>{settings.inboxDir.split('/').slice(-2).join('/') + '/' + stem + '.md'}</Text>
      ) : null}
      {errorBox}
      <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16}}>
        <Btn label="Cancel" onPress={cancel} />
        <Btn label={busy ? 'Saving' : 'Save'} cta disabled={busy || !title.trim()} onPress={save} />
      </View>
    </ScrollView>
  );
}

export default App;
