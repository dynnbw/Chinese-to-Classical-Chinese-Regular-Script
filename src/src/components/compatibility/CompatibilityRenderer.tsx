import { useEffect, useRef, useCallback } from 'react';
import type { CharDetail, CompatSettings } from '../../types';
import { safeSplitChars } from '../../core/unicode';

interface Props {
  charDetails: CharDetail[];
  getImgUrl: (char: string) => string;
  getCachedImg: (url: string) => string | null;
  cacheImg: (url: string) => void;
  settings: CompatSettings;
  pureText: string;
}

export default function CompatibilityRenderer({
  charDetails,
  getImgUrl,
  getCachedImg,
  cacheImg,
  settings,
  pureText,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const loadImage = useCallback((char: string, imgEl: HTMLImageElement) => {
    const url = getImgUrl(char);
    if (!url) {
      imgEl.classList.add('img-error');
      return;
    }
    const cached = settings.cacheEnabled ? getCachedImg(url) : null;
    if (cached) {
      imgEl.src = cached;
      return;
    }
    imgEl.src = url;
    imgEl.onload = () => {
      imgEl.classList.remove('img-loading');
      if (settings.cacheEnabled) cacheImg(url);
    };
    imgEl.onerror = () => {
      imgEl.classList.remove('img-loading');
      imgEl.classList.add('img-error');
    };
  }, [getImgUrl, getCachedImg, cacheImg, settings.cacheEnabled]);

  useEffect(() => {
    if (!containerRef.current) return;
    const imgs = containerRef.current.querySelectorAll<HTMLImageElement>('img[data-src]');
    imgs.forEach(img => {
      const char = img.dataset.char;
      if (char && settings.lazyLoad) {
        loadImage(char, img);
      }
    });
  }, [charDetails, settings.lazyLoad, loadImage]);

  const chars = charDetails.length > 0
    ? charDetails
    : safeSplitChars(pureText).map(char => ({ char, isSealTarget: false }));

  return (
    <div className="compat-result" ref={containerRef}>
      <div className="compat-image-layer">
        {chars.map((cd, i) => {
          const url = getImgUrl(cd.char);
          const cachedSrc = settings.cacheEnabled && url ? getCachedImg(url) : null;
          return (
            <span className="char-container" key={i}>
              <img
                className={`char-img ${!cachedSrc ? 'img-loading' : ''}`}
                src={cachedSrc || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjBGMEYwIi8+PC9zdmc+'}
                alt={settings.showCharInAlt ? cd.char : ''}
                title={`字符: ${cd.char}`}
                data-char={cd.char}
                data-src={!cachedSrc ? url : undefined}
                style={{ width: `${settings.imgSize}px`, height: `${settings.imgSize}px` }}
                onLoad={() => { if (!cachedSrc && settings.cacheEnabled && url) cacheImg(url); }}
              />
            </span>
          );
        })}
      </div>
      <div className="compat-select-layer">
        {chars.map((cd, i) => (
          <span key={i}>{cd.char}</span>
        ))}
      </div>
    </div>
  );
}
