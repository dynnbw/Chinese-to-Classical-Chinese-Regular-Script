import { useState, useCallback, useRef } from 'react';
import { useAppState } from '../contexts/AppContext';
import { convertText } from '../core/converter';
import type { CharDetail } from '../types';

export function useConversion() {
  const state = useAppState();
  const [charDetails, setCharDetails] = useState<CharDetail[]>([]);
  const lastResultRef = useRef<{ result: string; pureText: string; converted: number; total: number } | null>(null);

  const convert = useCallback((text: string) => {
    const r = convertText(text, state.direction);
    setCharDetails(r.charDetails);
    lastResultRef.current = r;
    return r;
  }, [state.direction]);

  return {
    convert,
    result: lastResultRef.current?.result ?? '',
    pureText: lastResultRef.current?.pureText ?? '',
    charDetails,
  };
}
