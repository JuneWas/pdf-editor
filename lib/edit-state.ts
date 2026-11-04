export type EditObject = {
  id: string; kind: 'text' | 'image' | 'highlight';
  // Anchor in native PDF user space (including crop origin and page rotation).
  x: number; y: number; width: number; height: number;
  text: string; fontSize: number; color: string; opacity: number; src?: string;
};
export type Pages = Record<number, EditObject[]>;
export type History = { past: Pages[]; present: Pages; future: Pages[] };
export type Action = { type: 'append'; page: number; item: EditObject } | { type: 'set'; page: number; objects: EditObject[] } | { type: 'undo' } | { type: 'redo' } | { type: 'reset' };
export const initialHistory: History = { past: [], present: {}, future: [] };
export function editReducer(state: History, action: Action): History {
  if (action.type === 'reset') return initialHistory;
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  const objects = action.type === 'append' ? [...(state.present[action.page] || []), action.item] : action.objects;
  return { past: [...state.past.slice(-99), state.present], present: { ...state.present, [action.page]: objects }, future: [] };
}
