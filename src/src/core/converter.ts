// ===== 转换引擎 (纯函数，无框架依赖) =====
import type { CharDetail, ConversionDirection } from '../types';
import { safeSplitChars } from './unicode';

let sealMap: Map<string, string> | null = null;
let reverseSealMap: Map<string, string> | null = null;

/** 用原始 JSON 对象初始化映射表 */
export function initMapping(raw: Record<string, string>): void {
  sealMap = new Map(Object.entries(raw));
  buildReverse();
}

/** 合并额外映射（从导入或 localStorage） */
export function mergeMapping(raw: Record<string, string>): void {
  if (!sealMap) {
    initMapping(raw);
    return;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (v) sealMap.set(k, v);
  }
  buildReverse();
}

/** 获取当前正��映射表条目数 */
export function getMappingSize(): number {
  return sealMap?.size ?? 0;
}

/** 导出当前映射表 */
export function exportMapping(): Record<string, string> {
  if (!sealMap) return {};
  return Object.fromEntries(sealMap);
}

/** 查表获取映射值 */
export function lookupChar(char: string, direction: ConversionDirection): string | null {
  if (direction === 'toSeal') {
    return sealMap?.get(char) ?? null;
  }
  return reverseSealMap?.get(char) ?? null;
}

/** 执行文字转换 */
export function convertText(
  text: string,
  direction: ConversionDirection
): { result: string; pureText: string; converted: number; total: number; charDetails: CharDetail[] } {
  if (!text?.trim()) {
    return { result: '', pureText: '', converted: 0, total: 0, charDetails: [] };
  }

  const chars = safeSplitChars(text);
  let result = '';
  let pureText = '';
  let converted = 0;
  const charDetails: CharDetail[] = [];

  const map = direction === 'toSeal' ? sealMap : reverseSealMap;

  for (const char of chars) {
    const mapped = map?.get(char) ?? null;
    if (mapped && mapped !== char) {
      result += mapped;
      pureText += mapped;
      converted++;
      for (const c of safeSplitChars(mapped)) {
        charDetails.push({ char: c, isSealTarget: direction === 'toSeal', codePoint: getCharCode(c) });
      }
    } else {
      result += char;
      pureText += char;
      charDetails.push({ char, isSealTarget: false, codePoint: getCharCode(char) });
    }
  }

  return {
    result,
    pureText,
    converted,
    total: chars.length,
    charDetails,
  };
}

function getCharCode(char: string): string {
  const cp = char.codePointAt(0);
  if (cp === undefined) return 'U+????';
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

function buildReverse(): void {
  if (!sealMap) return;
  reverseSealMap = new Map<string, string>();
  for (const [k, v] of sealMap) {
    if (v && !reverseSealMap.has(v)) {
      reverseSealMap.set(v, k);
    }
  }
}
