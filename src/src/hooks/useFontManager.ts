import { useState, useCallback, useRef } from 'react';
import type { FontConfig, FontCacheEntry } from '../types';
import { StorageKeys, getItem, setItem } from '../core/storage';

const LOCAL_FONT_COLLECTIONS: Record<string, {
  family: string;
  type: 'local-collection';
  faces: { src: string; unicodeRange?: string }[];
}> = {
  'noto-serif': {
    family: 'Unicode17_CJK',
    type: 'local-collection',
    faces: [
      { src: './fonts/Unicode17_CJK_0.ttf', unicodeRange: 'U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+2F800-2FA1F' },
      { src: './fonts/Unicode17_CJK_3.ttf', unicodeRange: 'U+20000-2A6DF,U+2A700-2B73F,U+2B740-2B81F,U+2B820-2CEAF,U+2CEB0-2EBEF,U+2EBF0-2EE5F' },
      { src: './fonts/Unicode17_CJK_2.ttf', unicodeRange: 'U+30000-3134F,U+31350-323AF,U+323B0-3347F' },
      { src: './fonts/Unicode17_CJK_1.ttf' },
    ],
  },
};

const MAX_CACHE = 10;

export function useFontManager() {
  const [currentFont, setCurrentFont] = useState<FontConfig | null>(() => {
    return getItem<FontConfig | null>(StorageKeys.FONT_SETTINGS, null);
  });
  const cacheRef = useRef<Map<string, FontCacheEntry>>(new Map());
  const localURLsRef = useRef<Set<string>>(new Set());

  const cacheSize = cacheRef.current.size;

  const evictLRU = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size < MAX_CACHE) return;
    let lruKey: string | null = null;
    let oldest = Date.now();
    for (const [k, v] of cache) {
      if (v.lastUsed < oldest) { oldest = v.lastUsed; lruKey = k; }
    }
    if (lruKey) {
      const entry = cache.get(lruKey)!;
      if (entry.objectURL) {
        URL.revokeObjectURL(entry.objectURL);
        localURLsRef.current.delete(entry.objectURL);
      }
      if (entry.styleElement?.parentNode) {
        entry.styleElement.parentNode.removeChild(entry.styleElement);
      }
      if (entry.fontFace) {
        try { document.fonts.delete(entry.fontFace); } catch { /* noop */ }
      }
      cache.delete(lruKey);
    }
  }, []);

  const addToCache = useCallback((key: string, fontFace: FontFace | null, objectURL: string | null, styleElement?: HTMLStyleElement) => {
    evictLRU();
    const entry: FontCacheEntry = { fontFace, objectURL, timestamp: Date.now(), lastUsed: Date.now(), styleElement };
    cacheRef.current.set(key, entry);
    if (objectURL) localURLsRef.current.add(objectURL);
  }, [evictLRU]);

  const applyFontToBody = useCallback((family: string) => {
    const fallbacks = '"Microsoft YaHei","SimSun",serif';
    const ff = family.includes('Microsoft YaHei') ? family : `${family},${fallbacks}`;
    document.body.style.fontFamily = ff;
    const testText = document.getElementById('fontTestText');
    const testText2 = document.getElementById('fontTestText2');
    if (testText) testText.style.fontFamily = ff;
    if (testText2) testText2.style.fontFamily = ff;
  }, []);

  const loadLocalCollection = useCallback(async (
    fontId: string,
    collection: typeof LOCAL_FONT_COLLECTIONS[string],
    fontName: string
  ) => {
    const cached = cacheRef.current.get(fontId);
    if (cached) {
      cached.lastUsed = Date.now();
      const cfg: FontConfig = { id: fontId, name: fontName, family: collection.family, type: 'cloud' };
      setCurrentFont(cfg);
      applyFontToBody(collection.family);
      return true;
    }

    const style = document.createElement('style');
    style.setAttribute('data-font-collection', fontId);
    style.textContent = collection.faces.map(f =>
      `@font-face {
    font-family: '${collection.family}';
    src: url('${f.src}') format('truetype');${f.unicodeRange ? `\n    unicode-range: ${f.unicodeRange};` : ''}
    font-display: swap;
  }`
    ).join('\n\n');
    document.head.appendChild(style);

    const cfg: FontConfig = { id: fontId, name: fontName, family: collection.family, type: 'cloud' };
    setCurrentFont(cfg);
    addToCache(fontId, null, null, style);
    applyFontToBody(collection.family);
    setItem(StorageKeys.FONT_SETTINGS, cfg);
    return true;
  }, [addToCache, applyFontToBody]);

  const loadCloudFont = useCallback(async (fontId: string, fontUrl: string, fontName: string, onStatus?: (msg: string, type: string) => void) => {
    const localCol = LOCAL_FONT_COLLECTIONS[fontId];
    if (localCol) {
      return loadLocalCollection(fontId, localCol, fontName);
    }

    const cached = cacheRef.current.get(fontId);
    if (cached) {
      cached.lastUsed = Date.now();
      const family = fontName.includes('Noto Serif') ? 'Noto Serif SC'
        : fontName.includes('LaoSongTi') ? 'LaoSongTi' : fontName;
      const cfg: FontConfig = { id: fontId, name: fontName, family, type: 'cloud' };
      setCurrentFont(cfg);
      applyFontToBody(family);
      return true;
    }

    try {
      const fontFace = new FontFace(fontName, `url("${fontUrl}")`);
      const loaded = await fontFace.load();
      document.fonts.add(loaded);

      const cfg: FontConfig = { id: fontId, name: fontName, family: fontName, type: 'cloud', url: fontUrl };
      setCurrentFont(cfg);
      addToCache(fontId, loaded, null);
      applyFontToBody(fontName);
      setItem(StorageKeys.FONT_SETTINGS, cfg);
      onStatus?.(`字體加載成功: ${fontName}`, 'good');
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知錯誤';
      onStatus?.(`字體加載失敗: ${msg}`, 'error');
      return false;
    }
  }, [addToCache, applyFontToBody, loadLocalCollection]);

  const loadLocalFont = useCallback(async (file: File, onStatus?: (msg: string, type: string) => void) => {
    const cacheKey = `local-${file.name}-${file.size}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      cached.lastUsed = Date.now();
      const name = 'LocalFont-' + file.name.replace(/\.[^/.]+$/, '');
      const cfg: FontConfig = { id: cacheKey, name: `${name} (${file.name})`, family: name, type: 'local' };
      setCurrentFont(cfg);
      applyFontToBody(name);
      return true;
    }

    try {
      const objectURL = URL.createObjectURL(file);
      const fontName = 'LocalFont-' + file.name.replace(/\.[^/.]+$/, '');
      const fontFace = new FontFace(fontName, `url(${objectURL})`);
      const loaded = await fontFace.load();
      document.fonts.add(loaded);

      const cfg: FontConfig = { id: cacheKey, name: `${fontName} (${file.name})`, family: fontName, type: 'local' };
      setCurrentFont(cfg);
      addToCache(cacheKey, loaded, objectURL);
      applyFontToBody(fontName);
      setItem(StorageKeys.FONT_SETTINGS, cfg);
      onStatus?.(`本地字體加載成功: ${file.name}`, 'good');
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知錯誤';
      onStatus?.(`本地字體加載失敗: ${msg}`, 'error');
      return false;
    }
  }, [addToCache, applyFontToBody]);

  const applySystemFont = useCallback((fontId: string, onStatus?: (msg: string, type: string) => void) => {
    let family: string;
    let name: string;
    switch (fontId) {
      case 'system-serif': family = 'serif'; name = '襯線字體'; break;
      case 'system-sans': family = 'sans-serif'; name = '無襯線字體'; break;
      default: family = '"Microsoft YaHei","SimSun",serif'; name = '系統默認';
    }
    const cfg: FontConfig = { id: fontId, name, family, type: 'system' };
    setCurrentFont(cfg);
    applyFontToBody(family);
    setItem(StorageKeys.FONT_SETTINGS, cfg);
    onStatus?.(`已切換到: ${name}`, 'good');
  }, [applyFontToBody]);

  const clearCache = useCallback(() => {
    const cache = cacheRef.current;
    for (const [, entry] of cache) {
      if (entry.objectURL) {
        URL.revokeObjectURL(entry.objectURL);
        localURLsRef.current.delete(entry.objectURL);
      }
      if (entry.styleElement?.parentNode) {
        entry.styleElement.parentNode.removeChild(entry.styleElement);
      }
      if (entry.fontFace) {
        try { document.fonts.delete(entry.fontFace); } catch { /* noop */ }
      }
    }
    cache.clear();
    for (const url of localURLsRef.current) {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    }
    localURLsRef.current.clear();
  }, []);

  const restoreFont = useCallback(async () => {
    const saved = getItem<FontConfig | null>(StorageKeys.FONT_SETTINGS, null);
    if (!saved) return;
    setCurrentFont(saved);
    if (saved.type === 'system') {
      applySystemFont(saved.id);
    } else if (saved.type === 'cloud') {
      const col = LOCAL_FONT_COLLECTIONS[saved.id];
      if (col) {
        loadLocalCollection(saved.id, col, saved.name || 'Unicode17_CJK');
      } else if (saved.url) {
        loadCloudFont(saved.id, saved.url, saved.name);
      } else {
        applyFontToBody(saved.family);
      }
    } else {
      applyFontToBody(saved.family);
    }
  }, [applyFontToBody, applySystemFont, loadLocalCollection, loadCloudFont]);

  return {
    currentFont,
    cacheSize,
    loadCloudFont,
    loadLocalFont,
    applySystemFont,
    clearCache,
    setCurrentFont,
    applyFontToBody,
    restoreFont,
  };
}
