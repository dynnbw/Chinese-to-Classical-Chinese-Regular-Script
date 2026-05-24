import { useState, useEffect, useMemo, type RefObject } from 'react';
import type { CharDetail } from '../../types';
import { convertText, getMappingSize } from '../../core/converter';
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

const POEMS: { title: string; lines: string[] }[] = [
  {
    title: '靜夜思',
    lines: ['牀前看月光', '疑是地上霜', '舉頭望山月', '低頭思故鄉'],
  },
  {
    title: '登鸛雀樓',
    lines: ['白日依山盡', '黃河入海流', '欲窮千里目', '更上一層樓'],
  },
  {
    title: '春曉',
    lines: ['春眠不覺曉', '處處聞啼鳥', '夜來風雨聲', '花落知多少'],
  },
  {
    title: '江雪',
    lines: ['千山鳥飛絕', '萬徑人蹤滅', '孤舟簑笠翁', '獨釣寒江雪'],
  },
  {
    title: '憫農',
    lines: ['鋤禾日當午', '汗滴禾下土', '誰知盤中餐', '粒粒皆辛苦'],
  },
];

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

  const samplePoem = useMemo(() =>
    POEMS[Math.floor(Math.random() * POEMS.length)],
    [],
  );

  const [poetryResults, setPoetryResults] = useState<{ line: string; converted: string }[]>([]);
  useEffect(() => {
    // 等待映射表初始化完成后再计算
    const tryConvert = () => {
      if (getMappingSize() > 0) {
        setPoetryResults(samplePoem.lines.map(line => ({
          line,
          converted: convertText(line, 'toSeal').pureText,
        })));
      } else {
        setTimeout(tryConvert, 100);
      }
    };
    tryConvert();
  }, [samplePoem]);

  return (
    <section className="section output-area">
      <h2>轉換結果</h2>
      <div className="vertical-textarea" ref={outputRef} style={{ resize: 'none' }}>
        {!hasResult ? (
          <>
            <p>轉換結果將在此處以豎排古籍樣式呈現。</p>
            {poetryResults.length > 0 && (
            <div className="poetry-sample">
              {poetryResults.map((p, i) => (
                <span key={i}>
                  <span className="poetry-row">
                    <span>{p.line}</span>
                    <span className="poetry-arrow">↓</span>
                    <span className="poetry-converted">{p.converted}</span>
                  </span>
                  {i < poetryResults.length - 1 && <><br /><br /></>}
                </span>
              ))}
            </div>
            )}
          </>
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
