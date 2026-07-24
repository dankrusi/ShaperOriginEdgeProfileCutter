import { DEFAULT_SETTINGS, STORAGE_KEY } from "./defaults";
import type { Settings } from "./types";

// Accepts an arbitrary parsed value and produces a valid Settings by coercing
// each known key to a finite number, falling back to the default otherwise.
// Also unwraps a { settings: {...} } envelope, so the JSON embedded in an
// exported SVG's <metadata> can be imported directly.
export function coerceSettings(input: unknown): Settings {
  let source: Record<string, unknown> =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  if (source.settings && typeof source.settings === "object") {
    source = source.settings as Record<string, unknown>;
  }

  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) result[key] = value;
  }
  return result;
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings, null, 2);
}

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    return coerceSettings(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The generator still works when storage is disabled.
  }
}
