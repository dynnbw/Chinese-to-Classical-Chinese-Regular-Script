// ===== localStorage 工具函数 =====

const PREFIX = 'sl-conv-';

const KEYS = {
  CUSTOM_MAPPINGS: `${PREFIX}custom-mappings`,
  REVERSE_MAPPINGS: `${PREFIX}reverse-mappings`,
  APP_SETTINGS: `${PREFIX}settings`,
  CONVERSION_DIRECTION: `${PREFIX}direction`,
  FONT_SETTINGS: `${PREFIX}font`,
  CUSTOM_FONT_URL: `${PREFIX}custom-font-url`,
  COMPATIBILITY_SETTINGS: `${PREFIX}compat-settings`,
  STATS: `${PREFIX}stats`,
} as const;

export function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* noop */ }
}

export const StorageKeys = KEYS;
