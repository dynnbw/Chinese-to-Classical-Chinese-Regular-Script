import { useEffect } from 'react';
import { useAppState, useAppDispatch } from '../contexts/AppContext';
import { StorageKeys, getItem, setItem } from '../core/storage';
import type { ConversionDirection, AppSettings } from '../types';

/** 启动时从 localStorage 恢复设置 */
export function useSettings() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  // 初始化加载
  useEffect(() => {
    const savedSettings = getItem<Partial<AppSettings>>(StorageKeys.APP_SETTINGS, {});
    if (Object.keys(savedSettings).length > 0) {
      dispatch({ type: 'SET_SETTINGS', payload: savedSettings });
    }

    const savedStats = getItem<{ success: number; total: number }>(StorageKeys.STATS, { success: 0, total: 0 });
    if (savedStats.success > 0 || savedStats.total > 0) {
      dispatch({ type: 'UPDATE_STATS', payload: savedStats });
    }

    const savedDir = getItem<ConversionDirection>(StorageKeys.CONVERSION_DIRECTION, 'toSeal');
    if (savedDir === 'toSeal' || savedDir === 'toTraditional') {
      dispatch({ type: 'SET_DIRECTION', payload: savedDir });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 保存设置变更
  useEffect(() => {
    setItem(StorageKeys.APP_SETTINGS, state.settings);
  }, [state.settings]);

  useEffect(() => {
    setItem(StorageKeys.CONVERSION_DIRECTION, state.direction);
  }, [state.direction]);

  useEffect(() => {
    setItem(StorageKeys.STATS, state.stats);
  }, [state.stats]);
}
