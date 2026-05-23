// ===== 核心类型定义 =====

export interface CharDetail {
  char: string;
  isSealTarget: boolean;
  codePoint?: string;
}

export interface ConversionResult {
  result: string;
  pureText: string;
  stats: { converted: number; total: number };
  charDetails: CharDetail[];
}

export type ConversionDirection = 'toSeal' | 'toTraditional';

export type FontType = 'cloud' | 'local' | 'system' | 'compatibility';

export interface FontConfig {
  id: string;
  name: string;
  family: string;
  type: FontType;
  url?: string;
}

export interface AppSettings {
  autoConvert: boolean;
  showCharCodes: boolean;
  autoCopy: boolean;
}

export interface CompatSettings {
  cacheEnabled: boolean;
  lazyLoad: boolean;
  imgSize: number;
  showCharInAlt: boolean;
  customUrlTemplate: string;
  maxCacheSize: number;
}

export interface AppStats {
  success: number;
  total: number;
}

export interface LastConversionResult {
  text: string;
  pureText: string;
  direction: ConversionDirection;
}

export type StatusType = 'good' | 'warning' | 'error';

export interface StatusInfo {
  message: string;
  type: StatusType;
}

export interface FontCacheEntry {
  fontFace: FontFace | null;
  objectURL: string | null;
  timestamp: number;
  lastUsed: number;
  styleElement?: HTMLStyleElement;
}

export interface ImageCacheEntry {
  url: string;
  timestamp: number;
  lastUsed: number;
}

export interface LocalFontCollection {
  family: string;
  type: 'local-collection';
  faces: { src: string; unicodeRange?: string }[];
}
