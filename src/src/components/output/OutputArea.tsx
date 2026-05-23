import type { RefObject } from 'react';
import type { CharDetail } from '../../types';
import CompatibilityRenderer from '../compatibility/CompatibilityRenderer';

interface Props {
  result: string;
  pureText: string;
  charDetails: CharDetail[];
  showCharCodes: boolean;
  isCompat: boolean;
  compatRenderer: ReturnType<typeof import('../../hooks/useCompatibilityMode').useCompatibilityMode>;
  onCopy: () => void;
  onSave: () => void;
  outputRef: RefObject<HTMLDivElement | null>;
}

export default function OutputArea({
  result,
  pureText,
  charDetails,
  showCharCodes,
  isCompat,
  compatRenderer,
  onCopy,
  onSave,
  outputRef,
}: Props) {
  const hasResult = result && pureText;

  return (
    <section className="section output-area">
      <h2>轉換結果</h2>
      <div className="vertical-textarea" ref={outputRef} style={{ resize: 'none' }}>
        {!hasResult ? (
          <p>轉換結果將在此處以豎排古籍樣式呈現。</p>
        ) : isCompat ? (
          <CompatibilityRenderer
            charDetails={charDetails}
            getImgUrl={compatRenderer.getImgUrl}
            getCachedImg={compatRenderer.getCachedImg}
            cacheImg={compatRenderer.cacheImg}
            settings={compatRenderer.settings}
            pureText={pureText}
          />
        ) : showCharCodes ? (
          charDetails.map((cd, i) => (
            <span className="comparison" key={i}>
              <span className={`converted-char ${cd.isSealTarget ? 'seal-char' : ''}`}>{cd.char}</span>
              <span className="codepoint-label">{cd.codePoint}</span>
            </span>
          ))
        ) : (
          charDetails.map((cd, i) => (
            <span key={i} className={cd.isSealTarget ? 'seal-char' : ''}>{cd.char}</span>
          ))
        )}
      </div>
      <div className="button-group">
        <button className="vertical-btn" data-rough="3" onClick={onCopy}>複製結果</button>
        <button className="vertical-btn" data-rough="4" onClick={onSave}>保存文字</button>
      </div>
    </section>
  );
}
