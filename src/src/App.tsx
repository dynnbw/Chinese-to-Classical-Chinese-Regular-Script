import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from './contexts/AppContext';
import { useSettings } from './hooks/useSettings';
import { useConversion } from './hooks/useConversion';
import { useFontManager } from './hooks/useFontManager';
import { useCompatibilityMode } from './hooks/useCompatibilityMode';
import { initMapping, getMappingSize, exportMapping } from './core/converter';
import { StorageKeys, getItem, setItem } from './core/storage';
import { SealMapping } from './data/sealMapping';
import VerticalContainer from './components/layout/VerticalContainer';
import Header from './components/header/Header';
import InputArea from './components/input/InputArea';
import OutputArea from './components/output/OutputArea';
import ControlPanel from './components/control/ControlPanel';
import StatusBar from './components/status/StatusBar';
import FontSettingsPanel from './components/font/FontSettingsPanel';
import MappingViewer from './components/control/MappingViewer';

export default function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  useSettings();

  const { convert, charDetails } = useConversion();
  const fontManager = useFontManager();
  const compatMode = useCompatibilityMode();

  const [showFontPanel, setShowFontPanel] = useState(false);
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const [showConversionPanel, setShowConversionPanel] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // ResizeObserver: 输出框尺寸跟随输入框
  useEffect(() => {
    const inputEl = inputRef.current;
    if (!inputEl) return;
    const sync = () => {
      const outEl = outputRef.current;
      if (!outEl) return;
      const rect = inputEl.getBoundingClientRect();
      outEl.style.width = `${rect.width}px`;
      outEl.style.height = `${rect.height}px`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(inputEl);
    return () => ro.disconnect();
  }, []);

  // 初始化映射表 + 恢复持久化状态（字体、兼容模式）
  useEffect(() => {
    const customMappings = getItem<Record<string, string>>(StorageKeys.CUSTOM_MAPPINGS, {});
    const merged = { ...SealMapping, ...customMappings };
    initMapping(merged);
    dispatch({ type: 'SET_MAPPING_SIZE', payload: getMappingSize() });
    dispatch({ type: 'SET_LAST_UPDATE', payload: new Date().toLocaleString() });
    fontManager.restoreFont();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doConvert = useCallback(() => {
    const text = inputRef.current?.value ?? '';
    if (!text.trim()) return;
    const convResult = convert(text);
    if (convResult) {
      dispatch({ type: 'SET_LAST_RESULT', payload: {
        text: convResult.result,
        pureText: convResult.pureText,
        direction: state.direction,
      }});
      dispatch({ type: 'UPDATE_STATS', payload: {
        success: state.stats.success + convResult.converted,
        total: state.stats.total + 1,
      }});
      if (state.settings.autoCopy) {
        navigator.clipboard.writeText(convResult.pureText).catch(() => {});
      }
    }
  }, [convert, state.direction, state.settings.autoCopy, state.stats.success, state.stats.total, dispatch]);

  const toggleDirection = useCallback(() => {
    const newDir = state.direction === 'toSeal' ? 'toTraditional' : 'toSeal';
    dispatch({ type: 'SET_DIRECTION', payload: newDir });
    setTimeout(doConvert, 50);
  }, [state.direction, doConvert, dispatch]);

  const loadSample = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = state.direction === 'toSeal'
        ? '天地日月山水木金火土人心中一二三四'
        : '𠀘𡍑𡆠𡴑𡴸𣱱𤆄𣎳𨤾𡈽';
      if (state.settings.autoConvert) setTimeout(doConvert, 50);
    }
  }, [state.direction, state.settings.autoConvert, doConvert]);

  const clearAll = useCallback(() => {
    if (inputRef.current) inputRef.current.value = '';
    dispatch({ type: 'SET_LAST_RESULT', payload: { text: '', pureText: '', direction: state.direction } });
  }, [state.direction, dispatch]);

  const importMapping = useCallback(async (url: string) => {
    try {
      dispatch({ type: 'SET_STATUS', payload: { message: '正在加載映射數據...', type: 'warning' }});
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (typeof data !== 'object' || !data) throw new Error('無效的數據格式');

      const oldSize = getMappingSize();
      const custom = getItem<Record<string, string>>(StorageKeys.CUSTOM_MAPPINGS, {});
      const merged = { ...custom, ...data };
      setItem(StorageKeys.CUSTOM_MAPPINGS, merged);
      initMapping({ ...SealMapping, ...merged });

      const newSize = getMappingSize();
      dispatch({ type: 'SET_MAPPING_SIZE', payload: newSize });
      dispatch({ type: 'SET_LAST_UPDATE', payload: new Date().toLocaleString() });
      dispatch({ type: 'SET_STATUS', payload: {
        message: `成功導入 ${newSize - oldSize} 條新映射`,
        type: 'good',
      }});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '未知錯誤';
      dispatch({ type: 'SET_STATUS', payload: { message: `導入失敗: ${msg}`, type: 'error' }});
    }
  }, [dispatch]);

  const exportMappingJson = useCallback(() => {
    const data = JSON.stringify(exportMapping(), null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `轉換映射表_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: 'SET_STATUS', payload: { message: '映射表已導出', type: 'good' }});
  }, [dispatch]);

  const exportText = useCallback(() => {
    const text = state.lastResult.pureText;
    if (!text?.trim()) {
      dispatch({ type: 'SET_STATUS', payload: { message: '沒有可導出的內容', type: 'warning' }});
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `篆楷轉換_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: 'SET_STATUS', payload: { message: '文字已導出', type: 'good' }});
  }, [state.lastResult.pureText, dispatch]);

  const copyResult = useCallback(() => {
    const text = state.lastResult.pureText;
    if (!text?.trim()) {
      dispatch({ type: 'SET_STATUS', payload: { message: '沒有可複製的內容', type: 'warning' }});
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => dispatch({ type: 'SET_STATUS', payload: { message: '已複製到剪貼板', type: 'good' }}))
      .catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        dispatch({ type: 'SET_STATUS', payload: { message: '已複製到剪貼板', type: 'good' }});
      });
  }, [state.lastResult.pureText, dispatch]);

  return (
    <>
      <div
        className="overlay overlay-iframe"
        id="iframeOverlay"
        style={{ display: showConversionPanel ? 'block' : 'none' }}
        onClick={() => setShowConversionPanel(false)}
      />
      <button
        className="close-panel-btn"
        style={{ display: showConversionPanel ? 'flex' : 'none' }}
        onClick={() => setShowConversionPanel(false)}
      >
        ×
      </button>
      <iframe
        id="conversionPanel"
        src="https://fanyi.baidu.com/mtpe-individual/transText#/"
        title="简繁转换工具"
        style={{ display: showConversionPanel ? 'block' : 'none' }}
      />

      {showFontPanel && (
        <>
          <div className="overlay" style={{ display: 'block' }} onClick={() => setShowFontPanel(false)} />
          <FontSettingsPanel
            fontManager={fontManager}
            compatMode={compatMode}
            onClose={() => setShowFontPanel(false)}
            onReconvert={doConvert}
          />
        </>
      )}

      {showMappingPanel && (
        <MappingViewer onClose={() => setShowMappingPanel(false)} />
      )}

      <VerticalContainer>
        <div className="app-container">
          <aside className="control-panel">
            <ControlPanel
              direction={state.direction}
              mappingSize={state.mappingSize}
              stats={state.stats}
              settings={state.settings}
              compatEnabled={compatMode.enabled}
              cacheSize={fontManager.cacheSize + compatMode.cacheSize}
              onToggleDirection={toggleDirection}
              onOpenFontSettings={() => setShowFontPanel(true)}
              onOpenMapping={() => setShowMappingPanel(true)}
              onOpenConversionPanel={() => setShowConversionPanel(v => !v)}
              onImport={importMapping}
              onExportMapping={exportMappingJson}
              onExportText={exportText}
              onClearCache={() => {
                fontManager.clearCache();
                compatMode.clearCache();
              }}
              onSettingsChange={(s) => dispatch({ type: 'SET_SETTINGS', payload: s })}
            />
          </aside>

          <main className="main-content">
            <Header />
            <InputArea
              inputRef={inputRef}
              onConvert={doConvert}
              onClear={clearAll}
              onSample={loadSample}
            />
            <OutputArea
              result={state.lastResult.text || ''}
              pureText={state.lastResult.pureText || ''}
              charDetails={charDetails}
              showCharCodes={state.settings.showCharCodes}
              isCompat={compatMode.enabled}
              compatRenderer={compatMode}
              onCopy={copyResult}
              onSave={exportText}
              outputRef={outputRef}
            />
            <StatusBar fontName={fontManager.currentFont?.name ?? '系統默認'} />
          </main>
        </div>
      </VerticalContainer>
    </>
  );
}
