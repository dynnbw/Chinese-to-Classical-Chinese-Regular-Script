import { type RefObject, useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppContext';

interface Props {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onConvert: () => void;
  onClear: () => void;
  onSample: () => void;
}

export default function InputArea({ inputRef, onConvert, onClear, onSample }: Props) {
  const state = useAppState();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isToSeal = state.direction === 'toSeal';

  const handleInput = () => {
    if (!state.settings.autoConvert) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(onConvert, 300);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <section className="section input-area">
      <h2>{isToSeal ? '繁體字輸入' : '篆書楷化字輸入'}</h2>
      <textarea
        ref={inputRef}
        className="vertical-textarea"
        style={{ height: 589, width: 300 }}
        placeholder={isToSeal ? '請在此處輸入繁體字...' : '請在此處輸入篆書楷化字...'}
        defaultValue="天地日月山水木金火土"
        onInput={handleInput}
      />
      <div className="button-group">
        <button className="vertical-btn" data-rough="4" onClick={onConvert}>執行轉換</button>
        <button className="vertical-btn" data-rough="1" onClick={onClear}>清空內容</button>
        <button className="vertical-btn" data-rough="2" onClick={onSample}>載入示例</button>
      </div>
    </section>
  );
}
