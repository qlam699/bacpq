import { useState } from 'react';
import {
  loadSettings,
  saveSettings,
  type Settings,
} from '../lib/storage';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  function updateSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  return { settings, updateSettings };
}
