import { useState, useRef, useCallback } from 'react';
import type { FontConfig } from '../../types';

interface FontManagerType {
  currentFont: FontConfig | null;
  cacheSize: number;
  loadCloudFont: (id: string, url: string, name: string, onStatus?: (msg: string, type: string) => void) => Promise<boolean>;
  loadLocalFont: (file: File, onStatus?: (msg: string, type: string) => void) => Promise<boolean>;
  applySystemFont: (id: string, onStatus?: (msg: string, type: string) => void) => void;
  clearCache: () => void;
  setCurrentFont: (f: FontConfig | null) => void;
  applyFontToBody: (family: string) => void;
}

interface CompatModeType {
  enabled: boolean;
  provider: 'svgfonts' | 'custom';
  settings: { imgSize: number; lazyLoad: boolean; cacheEnabled: boolean; showCharInAlt: boolean; customUrlTemplate: string; maxCacheSize: number };
  cacheSize: number;
  updateSettings: (s: Partial<CompatModeType['settings']>) => void;
  enable: (prov?: 'svgfonts' | 'custom') => void;
  disable: () => void;
  clearCache: () => void;
}

interface Props {
  fontManager: FontManagerType;
  compatMode: CompatModeType;
  onClose: () => void;
  onReconvert: () => void;
}

type TabId = 'cloud' | 'local' | 'system' | 'compatibility';

const CLOUD_FONTS = [
  { id: 'HuiWenFangSong', name: '汇文仿宋', url: './fonts/HuiWenFangSong.ttf', desc: '支持大量漢字，包括部分擴展區字符，適合古籍顯示' },
  { id: 'noto-serif', name: 'Unicode17_CJK', url: './fonts/Unicode17_CJK_0.ttf', desc: '按碼點映射加載 4 個本地 TTF 文件，覆蓋常用字、擴展區與回退字形' },
  { id: 'LaoSongTi', name: '老宋体', url: './fonts/LaoSongTi.ttf', desc: '支持大量漢字，字形來源於古籍' },
];

const SYSTEM_FONTS = [
  { id: 'system-default', name: '系統默認', desc: '使用瀏覽器默認字體設置' },
  { id: 'system-serif', name: '襯線字體 (Serif)', desc: '傳統印刷風格，適合古籍顯示' },
  { id: 'system-sans', name: '無襯線字體 (Sans-serif)', desc: '現代簡潔風格' },
];

export default function FontSettingsPanel({ fontManager, compatMode, onClose, onReconvert }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('cloud');
  const [selectedFontId, setSelectedFontId] = useState<string | null>(fontManager.currentFont?.id ?? null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const postApply = useCallback(() => {
    if (activeTab !== 'compatibility' && compatMode.enabled) {
      compatMode.disable();
    }
    setTimeout(onReconvert, 500);
  }, [activeTab, compatMode, onReconvert]);

  // ===== Cloud: click preset font = direct apply =====
  const applyCloudFont = useCallback(async (fontId: string) => {
    setSelectedFontId(fontId);
    const font = CLOUD_FONTS.find(f => f.id === fontId);
    if (!font) return;
    setApplying(true);
    await fontManager.loadCloudFont(font.id, font.url, font.name, () => {});
    setApplying(false);
    postApply();
  }, [fontManager, postApply]);

  // ===== Cloud: apply custom URL =====
  const applyCustomUrl = useCallback(async () => {
    const urlInput = document.getElementById('customFontUrl') as HTMLInputElement;
    const url = urlInput?.value?.trim();
    if (!url || !/^https?:\/\//.test(url)) {
      alert('請輸入有效的字體URL');
      return;
    }
    localStorage.setItem('sl-conv-custom-font-url', url);
    setSelectedFontId('custom-url');
    setApplying(true);
    await fontManager.loadCloudFont('custom', url, 'CustomFont', () => {});
    setApplying(false);
    postApply();
  }, [fontManager, postApply]);

  // ===== Local: file select = direct apply =====
  const handleLocalFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(`已選擇: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    setApplying(true);
    await fontManager.loadLocalFont(file, () => {});
    setApplying(false);
    postApply();
  }, [fontManager, postApply]);

  // ===== System: click = direct apply =====
  const applySystemFont = useCallback((fontId: string) => {
    setSelectedFontId(fontId);
    fontManager.applySystemFont(fontId, () => {});
    postApply();
  }, [fontManager, postApply]);

  // ===== Compatibility: click svgfonts = direct apply =====
  const applyCompatSvgFonts = useCallback(() => {
    setSelectedFontId('svgfonts-compatibility');
    compatMode.enable('svgfonts');
    fontManager.setCurrentFont({ id: 'compatibility-mode', name: '圖片兼容模式', family: 'system-default', type: 'compatibility' });
    fontManager.applyFontToBody('system-default');
    postApply();
  }, [compatMode, fontManager, postApply]);

  // ===== Compatibility: apply custom img url =====
  const applyCompatCustom = useCallback(() => {
    const urlInput = document.getElementById('customImgUrl') as HTMLInputElement;
    const url = urlInput?.value?.trim();
    if (!url) {
      alert('請輸入圖片URL模板');
      return;
    }
    setSelectedFontId('custom-compatibility');
    compatMode.updateSettings({ customUrlTemplate: url });
    compatMode.enable('custom');
    fontManager.setCurrentFont({ id: 'compatibility-mode', name: '圖片兼容模式(自定義)', family: 'system-default', type: 'compatibility' });
    fontManager.applyFontToBody('system-default');
    postApply();
  }, [compatMode, fontManager, postApply]);

  return (
    <div id="fontSettingsPanel" style={{ display: 'block' }}>
      <button className="close-font-btn" onClick={onClose}>×</button>
      <h3>字體設置</h3>

      <div className="font-tab">
        {(['cloud', 'local', 'system', 'compatibility'] as TabId[]).map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {{ cloud: '預置字體', local: '本地字體', system: '系統字體', compatibility: '兼容模式' }[tab]}
          </button>
        ))}
      </div>

      {/* Cloud Tab */}
      <div className={`font-tab-content ${activeTab === 'cloud' ? 'active' : ''}`}>
        <p>{applying ? '正在加載字體...' : '點擊字體即可切換：'}</p>
        {CLOUD_FONTS.map(f => (
          <div
            key={f.id}
            className={`font-option ${selectedFontId === f.id ? 'selected' : ''}`}
            onClick={() => applyCloudFont(f.id)}
            style={{ opacity: applying ? 0.6 : 1, pointerEvents: applying ? 'none' : 'auto' }}
          >
            <div className="font-name">{f.name}</div>
            <div className="font-description">{f.desc}</div>
          </div>
        ))}
        <div
          className={`font-option ${selectedFontId === 'custom-url' ? 'selected' : ''}`}
          onClick={() => setSelectedFontId('custom-url')}
        >
          <div className="font-name">自定義字體URL</div>
          <div className="font-description">輸入自定義字體的URL地址</div>
          <input
            type="text"
            id="customFontUrl"
            className="url-input"
            placeholder="輸入字體文件URL (支持 .woff, .woff2, .ttf, .otf)"
            defaultValue={localStorage.getItem('sl-conv-custom-font-url') || ''}
            onKeyDown={(e) => { if (e.key === 'Enter') applyCustomUrl(); }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="apply-font-btn"
            onClick={(e) => { e.stopPropagation(); applyCustomUrl(); }}
            style={{ marginTop: '0.5em', padding: '0.3em 0.8em' }}
          >
            加載自定義字體
          </button>
        </div>
      </div>

      {/* Local Tab */}
      <div className={`font-tab-content ${activeTab === 'local' ? 'active' : ''}`}>
        <p>上傳字體文件，選擇後自動加載：</p>
        <label className="file-input-label">
          {applying ? '正在加載...' : '選擇字體文件'}
          <input
            ref={fileRef}
            type="file"
            className="file-input"
            accept=".ttf,.otf,.woff,.woff2,.eot"
            onChange={handleLocalFile}
            disabled={applying}
          />
        </label>
        {selectedFileName && <div style={{ marginTop: '0.5em', fontSize: '0.9em', color: '#7a6c55' }}>{selectedFileName}</div>}
        <div className="font-description" style={{ marginTop: '0.5em' }}>
          <p>支持的字體格式：TTF, OTF, WOFF, WOFF2, EOT</p>
          <p>建議使用支持擴展漢字的字體</p>
          <p style={{ color: '#d9534f', fontWeight: 'bold' }}>注意：使用後請及時清理緩存釋放內存</p>
        </div>
      </div>

      {/* System Tab */}
      <div className={`font-tab-content ${activeTab === 'system' ? 'active' : ''}`}>
        <p>點擊即可切換：</p>
        {SYSTEM_FONTS.map(f => (
          <div
            key={f.id}
            className={`font-option ${selectedFontId === f.id ? 'selected' : ''}`}
            onClick={() => applySystemFont(f.id)}
          >
            <div className="font-name">{f.name}</div>
            <div className="font-description">{f.desc}</div>
            <div className="font-preview">天地日月山水木金火土</div>
          </div>
        ))}
      </div>

      {/* Compatibility Tab */}
      <div className={`font-tab-content ${activeTab === 'compatibility' ? 'active' : ''}`}>
        <p><strong>字符圖片顯示模式</strong></p>
        <p>點擊即可啟用，確保最大兼容性：</p>

        <div
          className={`font-option ${selectedFontId === 'svgfonts-compatibility' ? 'selected' : ''}`}
          onClick={applyCompatSvgFonts}
        >
          <div className="font-name">GlyphWiki SVG字庫</div>
          <div className="font-description">
            <p>使用GlyphWiki開源SVG字庫，支持超過10萬漢字</p>
            <p>圖片來源: <a href="https://zhs.glyphwiki.org/" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>GlyphWiki</a></p>
            <p>部分瀏覽器請安裝CORS Unblock插件使用</p>
          </div>
        </div>

        <div
          className={`font-option ${selectedFontId === 'custom-compatibility' ? 'selected' : ''}`}
          onClick={() => setSelectedFontId('custom-compatibility')}
        >
          <div className="font-name">自定義圖片字庫</div>
          <div className="font-description">使用自定義的圖片字庫URL</div>
          <input
            type="text"
            id="customImgUrl"
            className="url-input"
            placeholder="輸入圖片URL模板，使用{unicode}作為碼點佔位符"
            defaultValue={compatMode.settings.customUrlTemplate}
            onKeyDown={(e) => { if (e.key === 'Enter') applyCompatCustom(); }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="apply-font-btn"
            onClick={(e) => { e.stopPropagation(); applyCompatCustom(); }}
            style={{ marginTop: '0.5em', padding: '0.3em 0.8em' }}
          >
            啟用自定義
          </button>
        </div>

        <div className="compat-settings">
          <h4>圖片顯示設置</h4>
          <label style={{ fontSize: '0.9em', display: 'block', margin: '0.3em 0' }}>
            <input type="checkbox" checked={compatMode.settings.cacheEnabled}
              onChange={(e) => compatMode.updateSettings({ cacheEnabled: e.target.checked })} /> 緩存圖片
          </label>
          <label style={{ fontSize: '0.9em', display: 'block', margin: '0.3em 0' }}>
            <input type="checkbox" checked={compatMode.settings.lazyLoad}
              onChange={(e) => compatMode.updateSettings({ lazyLoad: e.target.checked })} /> 延遲加載
          </label>
          <label style={{ fontSize: '0.9em', display: 'block', margin: '0.3em 0' }}>
            圖片尺寸:
            <input type="range" min="16" max="100" value={compatMode.settings.imgSize}
              onChange={(e) => compatMode.updateSettings({ imgSize: parseInt(e.target.value) })}
              style={{ width: '60%' }} />
            <span>{compatMode.settings.imgSize}px</span>
          </label>
          <label style={{ fontSize: '0.9em', display: 'block', margin: '0.3em 0' }}>
            <input type="checkbox" checked={compatMode.settings.showCharInAlt}
              onChange={(e) => compatMode.updateSettings({ showCharInAlt: e.target.checked })} /> 在alt屬性顯示原字符
          </label>
          <label style={{ fontSize: '0.9em', display: 'block', margin: '0.3em 0' }}>
            最大緩存數:
            <input type="number" min="10" max="25565" value={compatMode.settings.maxCacheSize}
              onChange={(e) => compatMode.updateSettings({ maxCacheSize: parseInt(e.target.value) || 100 })}
              style={{ width: '50px' }} />
          </label>
        </div>
      </div>

      <div className="font-test-area">
        <p>字體測試區域：</p>
        <div className="font-test-text" id="fontTestText">天地日月山水木金火土 漢書樂龜龍馬鳥魚</div>
        <div className="font-test-text" id="fontTestText2">篆書楷化字示例：𠀘𡍑𡆠𡴑𡴸𣱱𤆄𣎳𨤾𡈽</div>
      </div>
    </div>
  );
}
