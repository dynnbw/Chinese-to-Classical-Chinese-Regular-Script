// ===== Unicode 字符处理工具 =====

/** 安全分割字符串，正确处��代理对 */
export function safeSplitChars(str: string): string[] {
  if (!str) return [];
  const chars: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        chars.push(str.substring(i, i + 2));
        i++;
        continue;
      }
    }
    chars.push(str.charAt(i));
  }
  return chars;
}

/** 获取字符的 Unicode 码点字符串 */
export function getCodePoint(char: string): string {
  if (!char) return '';
  const cp = char.codePointAt(0);
  if (cp === undefined) return 'U+????';
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

/** HTML 转义 */
export function escapeHtml(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
