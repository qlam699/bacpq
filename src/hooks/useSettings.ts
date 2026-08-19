import { useCallback, useRef, useState } from 'react';
import {
  loadSettings,
  saveSettings,
  type Settings,
} from '../lib/storage';
import {
  loadSettingsFromGist,
  saveSettingsToGist,
} from '../lib/gistSettings';

type GistRef = { token: string; gistId: string } | null;

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const gistRef = useRef<GistRef>(null);
  const loadedGistRef = useRef<string | null>(null);

  const setGist = useCallback((token: string | null, gistId: string | null) => {
    if (token && gistId) {
      gistRef.current = { token, gistId };
      if (loadedGistRef.current !== gistId) {
        loadedGistRef.current = gistId;
        void loadSettingsFromGist(token, gistId).then((remote) => {
          if (!remote) return;
          setSettings((prev) => {
            const merged = { ...prev, ...remote };
            saveSettings(merged);
            return merged;
          });
        }).catch(() => {});
      }
    } else {
      gistRef.current = null;
      loadedGistRef.current = null;
    }
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next);
        const g = gistRef.current;
        if (g) {
          void saveSettingsToGist(g.token, g.gistId, next).catch(() => {});
        }
        return next;
      });
    },
    [],
  );

  return { settings, updateSettings, setGist };
}
