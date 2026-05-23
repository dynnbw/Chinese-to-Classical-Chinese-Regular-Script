import { useState, useCallback, useRef } from 'react';
import type { CompatSettings, ImageCacheEntry } from '../types';
import { StorageKeys, getItem, setItem } from '../core/storage';
import { getCodePoint } from '../core/unicode';

const DEFAULT_SETTINGS: CompatSettings = {
  cacheEnabled: true,
  lazyLoad: true,
  imgSize: 24,
  showCharInAlt: true,
  customUrlTemplate: '',
  maxCacheSize: 100,
};

export function useCompatibilityMode() {
  const [enabled, setEnabled] = useState(() => {
    const saved = getItem<Partial<{ enabled: boolean; provider: string }>>(StorageKeys.COMPATIBILITY_SETTINGS, {});
    return saved.enabled ?? false;
  });
  const [provider, setProvider] = useState<'svgfonts' | 'custom'>(() => {
    const saved = getItem<Partial<{ provider: string }>>(StorageKeys.COMPATIBILITY_SETTINGS, {});
    return (saved.provider as 'svgfonts' | 'custom') || 'svgfonts';
  });
  const [settings, setSettings] = useState<CompatSettings>(() => {
    const saved = getItem<Partial<CompatSettings>>(StorageKeys.COMPATIBILITY_SETTINGS, {});
    return { ...DEFAULT_SETTINGS, ...saved };
  });
  const imgCacheRef = useRef<Map<string, ImageCacheEntry>>(new Map());
  const lruKeysRef = useRef<string[]>([]);

  const cacheSize = imgCacheRef.current.size;

  const saveSettings = useCallback((s: CompatSettings) => {
    setItem(StorageKeys.COMPATIBILITY_SETTINGS, { ...s, currentProvider: provider });
  }, [provider]);

  const updateSettings = useCallback((partial: Partial<CompatSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, [saveSettings]);

  const getImgUrl = useCallback((char: string): string => {
    const codeHex = getCodePoint(char).replace('U+', '');
    if (!codeHex || codeHex === '????') return '';
    if (provider === 'svgfonts') {
      return `https://zhs.glyphwiki.org/glyph/u${codeHex.toLowerCase()}.svg`;
    }
    return settings.customUrlTemplate.replace('{unicode}', codeHex);
  }, [provider, settings.customUrlTemplate]);

  const evictLRU = useCallback(() => {
    const cache = imgCacheRef.current;
    const keys = lruKeysRef.current;
    if (cache.size >= settings.maxCacheSize && keys.length > 0) {
      const lruKey = keys.shift()!;
      cache.delete(lruKey);
    }
  }, [settings.maxCacheSize]);

  const getCachedImg = useCallback((url: string): string | null => {
    const entry = imgCacheRef.current.get(url);
    if (entry) {
      entry.lastUsed = Date.now();
      const keys = lruKeysRef.current;
      const idx = keys.indexOf(url);
      if (idx > -1) keys.splice(idx, 1);
      keys.push(url);
      return entry.url;
    }
    return null;
  }, []);

  const cacheImg = useCallback((url: string) => {
    if (!settings.cacheEnabled) return;
    evictLRU();
    imgCacheRef.current.set(url, { url, timestamp: Date.now(), lastUsed: Date.now() });
    lruKeysRef.current.push(url);
  }, [settings.cacheEnabled, evictLRU]);

  const enable = useCallback((prov: 'svgfonts' | 'custom' = 'svgfonts') => {
    setEnabled(true);
    setProvider(prov);
    saveSettings(settings);
  }, [settings, saveSettings]);

  const disable = useCallback(() => {
    setEnabled(false);
    saveSettings(settings);
  }, [settings, saveSettings]);

  const clearCache = useCallback(() => {
    imgCacheRef.current.clear();
    lruKeysRef.current = [];
  }, []);

  return {
    enabled,
    provider,
    settings,
    cacheSize,
    updateSettings,
    getImgUrl,
    getCachedImg,
    cacheImg,
    enable,
    disable,
    clearCache,
  };
}
