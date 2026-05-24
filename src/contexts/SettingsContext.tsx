import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light";

export interface Settings {
  theme: Theme;
  fontSize: number;
}

const STORAGE_KEY = "tabffy-settings";

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  fontSize: 12,
};

interface SettingsContextValue {
  settings: Settings;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
        fontSize: parsed.fontSize ?? DEFAULT_SETTINGS.fontSize,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function persistSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(settings.theme);
    persistSettings(settings);
  }, [settings]);

  const setTheme = useCallback((theme: Theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const setFontSize = useCallback((fontSize: number) => {
    setSettings((prev) => ({ ...prev, fontSize }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, setTheme, setFontSize }}>
      {children}
    </SettingsContext.Provider>
  );
}
