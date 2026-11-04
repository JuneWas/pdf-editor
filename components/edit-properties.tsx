'use client';
import { useState } from 'react';
import type { EditObject } from '@/lib/edit-state';
export default function EditProperties({ item, onSave, onDelete }: { item: EditObject; onSave: (item: EditObject) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(item);
  return <form onSubmit={event => { event.preventDefault(); onSave(draft); }} className="edit-properties">
    <h3>{item.kind === 'text' ? '文字' : item.kind === 'image' ? '画像' : 'ハイライト'}</h3>
    {item.kind === 'text' && <><label>文字の内容<textarea value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} rows={5} /></label><label>文字サイズ<input type="number" min="6" max="200" required value={draft.fontSize} onChange={event => setDraft({ ...draft, fontSize: Number(event.target.value) })} /></label></>}
    {item.kind !== 'image' && <label>色<input type="color" value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value })} /></label>}
    {item.kind === 'highlight' && <label>不透明度 {Math.round(draft.opacity * 100)}%<input type="range" min="0.05" max="1" step="0.05" value={draft.opacity} onChange={event => setDraft({ ...draft, opacity: Number(event.target.value) })} /></label>}
    <button type="submit">変更を適用</button><button type="button" onClick={onDelete}>選択要素を削除</button>
    <p>文字は入力後に適用してください。画像・ハイライトは選択枠でサイズを変更できます。</p>
  </form>;
}
