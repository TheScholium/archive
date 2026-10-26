import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import App from '../App';
import {captureLasso, session} from '../src/archive';
import {emit} from '../src/bus';

const files: Map<string, any> = (global as any).__files;
const host = (global as any).__host;

describe('App', () => {
  it('shows the idle screen when nothing is selected', async () => {
    session.capture = null;
    session.wantSettings = false;
    render(<App />);
    expect(await screen.findByText(/Lasso a section/)).toBeTruthy();
  });

  it('saves a note after the title is typed', async () => {
    const cap = await captureLasso(new Date(2026, 9, 24, 21, 36, 0));
    if (!cap.ok) throw new Error('capture failed');
    session.capture = cap.capture;
    session.wantSettings = false;
    render(<App />);
    const input = await screen.findByPlaceholderText('Title');
    const save = screen.getByLabelText('Save');
    expect(save.props.accessibilityState?.disabled ?? save.props.disabled).toBeTruthy();
    fireEvent.changeText(input, 'Christoffel symbols');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save'));
    });
    await waitFor(() => expect(host.closed).toBe(1));
    const notes = [...files.keys()].filter(k => k.endsWith('/Christoffel symbols.md'));
    expect(notes).toHaveLength(1);
    expect(String(files.get(notes[0]))).toContain('![[Christoffel symbols ');
    expect(host.dialogs[0]).toContain('Saved Christoffel symbols.md');
  });

  it('keeps the screen open and shows the error when the save fails', async () => {
    const cap = await captureLasso(new Date(2026, 9, 24, 21, 36, 0));
    if (!cap.ok) throw new Error('capture failed');
    files.delete(cap.capture.previewPath); // the copy will fail
    session.capture = cap.capture;
    render(<App />);
    fireEvent.changeText(await screen.findByPlaceholderText('Title'), 'X');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Save'));
    });
    expect(await screen.findByText(/ENOENT/)).toBeTruthy();
    expect(host.closed).toBe(0);
  });

  it('opens the settings from the config button', async () => {
    session.capture = null;
    session.wantSettings = true;
    render(<App />);
    expect(await screen.findByText('Archive settings')).toBeTruthy();
    act(() => emit('ui-shown'));
    expect(screen.getByText('Archive settings')).toBeTruthy();
  });
});
