import { useAppState } from '../../contexts/AppContext';

interface Props {
  fontName: string;
}

export default function StatusBar({ fontName }: Props) {
  const state = useAppState();
  const { type, message } = state.status;

  const dotClass = type === 'good' ? 'status-good' : type === 'warning' ? 'status-warning' : 'status-error';

  return (
    <div className="status-bar">
      <span className={`status-dot ${dotClass}`} />
      <span>{message}</span>
      <span>|</span>
      <span>映射數: <strong>{state.mappingSize}</strong></span>
      <span>|</span>
      <span>轉換次數: <strong>{state.stats.total}</strong></span>
      <span>|</span>
      <span>字體: <strong>{fontName}</strong></span>
    </div>
  );
}
