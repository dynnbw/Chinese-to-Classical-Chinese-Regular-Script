import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import type { ConversionDirection, AppSettings, AppStats, LastConversionResult, StatusInfo } from '../types';

// ===== State =====
export interface AppState {
  direction: ConversionDirection;
  settings: AppSettings;
  stats: AppStats;
  lastUpdate: string;
  lastResult: LastConversionResult;
  status: StatusInfo;
  mappingSize: number;
}

const initialState: AppState = {
  direction: 'toSeal',
  settings: { autoConvert: true, showCharCodes: false, autoCopy: true },
  stats: { success: 0, total: 0 },
  lastUpdate: '-',
  lastResult: { text: '', pureText: '', direction: 'toSeal' },
  status: { message: '系統就緒', type: 'good' },
  mappingSize: 0,
};

// ===== Actions =====
export type AppAction =
  | { type: 'SET_DIRECTION'; payload: ConversionDirection }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_STATUS'; payload: StatusInfo }
  | { type: 'UPDATE_STATS'; payload: { success: number; total: number } }
  | { type: 'SET_LAST_RESULT'; payload: LastConversionResult }
  | { type: 'SET_LAST_UPDATE'; payload: string }
  | { type: 'SET_MAPPING_SIZE'; payload: number };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DIRECTION':
      return { ...state, direction: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'UPDATE_STATS':
      return { ...state, stats: { ...state.stats, ...action.payload } };
    case 'SET_LAST_RESULT':
      return { ...state, lastResult: action.payload };
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdate: action.payload };
    case 'SET_MAPPING_SIZE':
      return { ...state, mappingSize: action.payload };
    default:
      return state;
  }
}

// ===== Context =====
const AppCtx = createContext<AppState>(initialState);
const DispatchCtx = createContext<Dispatch<AppAction>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>
        {children}
      </DispatchCtx.Provider>
    </AppCtx.Provider>
  );
}

export function useAppState() {
  return useContext(AppCtx);
}

export function useAppDispatch() {
  return useContext(DispatchCtx);
}
