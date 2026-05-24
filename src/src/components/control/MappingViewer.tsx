import { useMemo } from 'react';
import { useAppState } from '../../contexts/AppContext';
import { exportMapping } from '../../core/converter';

interface Props {
  onClose: () => void;
}

export default function MappingViewer({ onClose }: Props) {
  const state = useAppState();
  const mapping = exportMapping();
  const entries = useMemo(() => Object.entries(mapping), [mapping]);
  const isToSeal = state.direction === 'toSeal';

  return (
    <>
      <div className="overlay" style={{ display: 'block' }} onClick={onClose} />
      <div id="mappingPanel">
        <button className="close-font-btn" onClick={onClose}>×</button>
        <h3>
          {isToSeal ? '正向映射（繁體→篆書）' : '反向映射（篆書→繁體）'}
          <span style={{ fontSize: '0.7em', color: 'var(--color-ink-light)', marginInlineStart: '0.5em' }}>
            {entries.length} 條
          </span>
        </h3>
        <div className="mapping-list">
          {entries.map(([src, tgt]) => (
            <div className="mapping-item" key={src}>
              <span className="mapping-src">{src}</span>
              <span className="mapping-arrow">↓</span>
              <span className="mapping-tgt">{tgt}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
