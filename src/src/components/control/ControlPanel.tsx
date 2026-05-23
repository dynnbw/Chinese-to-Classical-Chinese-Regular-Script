import Tooltip from '../common/Tooltip';
import type { ConversionDirection, AppSettings, AppStats } from '../../types';

interface Props {
  direction: ConversionDirection;
  mappingSize: number;
  stats: AppStats;
  settings: AppSettings;
  compatEnabled: boolean;
  cacheSize: number;
  onToggleDirection: () => void;
  onOpenFontSettings: () => void;
  onOpenMapping: () => void;
  onOpenConversionPanel: () => void;
  onImport: (url: string) => void;
  onExportMapping: () => void;
  onExportText: () => void;
  onClearCache: () => void;
  onSettingsChange: (s: Partial<AppSettings>) => void;
}

/** 给按钮分配不同的不规则边缘滤镜 */
const R = (n: number) => ({ 'data-rough': n }) as React.HTMLAttributes<HTMLElement>;

export default function ControlPanel({
  direction,
  mappingSize,
  stats,
  settings,
  cacheSize,
  onToggleDirection,
  onOpenFontSettings,
  onOpenMapping,
  onOpenConversionPanel,
  onImport,
  onExportMapping,
  onExportText,
  onClearCache,
  onSettingsChange,
}: Props) {
  const isToSeal = direction === 'toSeal';

  return (
    <>
      <h3>控制面板</h3>

      <Tooltip text="打開/關閉簡體轉繁體工具">
        <button className="vertical-btn" id="togglePanelBtn" onClick={onOpenConversionPanel} {...R(1)}>
          簡繁轉換
        </button>
      </Tooltip>

      <Tooltip text="設置自定義字體">
        <button className="vertical-btn" id="fontSettingsBtn" onClick={onOpenFontSettings} {...R(2)}>
          字體設置
        </button>
      </Tooltip>

      <Tooltip text="從URL導入映射數據">
        <button className="vertical-btn" onClick={() => {
          const url = prompt('請輸入映射數據的URL（JSON格式）:',
            'https://raw.githubusercontent.com/dynnbw/Chinese-to-Classical-Chinese-Regular-Script/refs/heads/main/convert.json');
          if (url) onImport(url);
        }} {...R(3)}>
          導入數據
        </button>
      </Tooltip>

      <Tooltip text="查看當前所有映射關係">
        <button className="vertical-btn" onClick={onOpenMapping} {...R(4)}>查看映射</button>
      </Tooltip>

      <Tooltip text="導出當前映射表 JSON 數據">
        <button className="vertical-btn" onClick={onExportMapping} {...R(1)}>導出數據</button>
      </Tooltip>

      <Tooltip text="導出當前轉換結果">
        <button className="vertical-btn" onClick={onExportText} {...R(1)}>導出文字</button>
      </Tooltip>

      <Tooltip text="切換轉換方向 (繁體↔篆書)">
        <button
          className="vertical-btn"
          id="toggleDirectionBtn"
          onClick={onToggleDirection}
          {...R(2)}
        >
          {isToSeal ? '繁→篆楷' : '篆楷→繁'}
        </button>
      </Tooltip>

      <Tooltip text="清理字体和图片缓存">
        <button className="vertical-btn" id="clearCacheBtn" onClick={onClearCache} {...R(3)}>
          清理緩存
        </button>
      </Tooltip>

      <div className="stats-row">
        <div className="stats-container">
          <h4>系統統計</h4>
          <div className="stat-item">映射總數: <span className="stat-value">{mappingSize}</span></div>
          <div className="stat-item">成功轉換: <span className="stat-value">{stats.success}</span></div>
          <div className="stat-item">轉換次數: <span className="stat-value">{stats.total}</span></div>
          <div className="stat-item">緩存大小: <span className="stat-value">{cacheSize}</span></div>
        </div>

        <div className="stats-container">
          <h4>設置選項</h4>
          <div className="settings-list">
            <label className="setting-item">
              <input type="checkbox" checked={settings.autoConvert} onChange={(e) => onSettingsChange({ autoConvert: e.target.checked })} />
              <span>實時轉換</span>
            </label>
            <label className="setting-item">
              <input type="checkbox" checked={settings.showCharCodes} onChange={(e) => onSettingsChange({ showCharCodes: e.target.checked })} />
              <span>顯示碼點</span>
            </label>
            <label className="setting-item">
              <input type="checkbox" checked={settings.autoCopy} onChange={(e) => onSettingsChange({ autoCopy: e.target.checked })} />
              <span>自動複製</span>
            </label>
          </div>
        </div>
      </div>

      <div className="social-links">
        <a style={{ color: '#6b3f4a' }} href="https://space.bilibili.com/470023065">
          <h4 style={{ color: '#6b3f4a', fontSize: '0.9em' }}>关注喵~</h4>
        </a>
        <a style={{ color: '#161823' }} href="https://www.douyin.com/user/MS4wLjABAAAAfAvvj21s4RxLYdzQV5gWxNIL4eYKD5authYE8WXD6i99MC0-RaUhAPLIIes2EC4w">
          <h4 style={{ color: '#161823', fontSize: '0.9em' }}>关注喵~</h4>
        </a>
      </div>
    </>
  );
}
