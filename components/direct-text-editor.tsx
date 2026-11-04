'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEngine } from '@/lib/mupdf-client';
import { readLines, replaceLine, type TextLine } from '@/lib/direct-text';

export default function DirectTextEditor({ bytes, page, scale, enabled, name, onReplace }: {
  bytes: Uint8Array<ArrayBuffer>; page: number; scale: number; enabled: boolean; name: string;
  onReplace: (data: Uint8Array<ArrayBuffer>) => Promise<boolean>;
}) {
  const [result, setResult] = useState<{ bytes: Uint8Array; page: number; lines: TextLine[] }>();
  const [selection, setSelection] = useState<{ line: TextLine; page: number; bytes: Uint8Array }>();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<Uint8Array<ArrayBuffer>[]>([]);
  const [future, setFuture] = useState<Uint8Array<ArrayBuffer>[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getEngine().then(m => {
      const lines = readLines(m, bytes, page - 1);
      if (active) { setResult({ bytes, page, lines }); setError(''); }
    }).catch(() => { if (active) setError('文字情報を読み込めません。暗号化・破損したPDFは対象外です。'); });
    return () => { active = false; };
  }, [bytes, page, enabled]);
  const lines = result?.bytes === bytes && result.page === page ? result.lines : [];
  const current = selection?.bytes === bytes && selection.page === page && enabled ? selection : undefined;
  const apply = async () => {
    if (!current || busy) return;
    setBusy(true); setError('');
    try {
      const data = replaceLine(await getEngine(), bytes, page - 1, current.line, value);
      if (await onReplace(data)) { setPast(previous => [...previous.slice(-9), bytes]); setFuture([]); setSelection(undefined); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : '文字を変更できませんでした。'); }
    finally { setBusy(false); }
  };
  const travel = async (redo: boolean) => {
    const items = redo ? future : past;
    const data = items.at(-1); if (!data || busy) return;
    setBusy(true);
    try {
      if (await onReplace(data)) {
        if (redo) { setFuture(items.slice(0, -1)); setPast([...past, bytes]); }
        else { setPast(items.slice(0, -1)); setFuture([...future, bytes]); }
        setSelection(undefined);
      }
    } finally { setBusy(false); }
  };
  const panel = window.document.getElementById('direct-panel');
  return <>
    {enabled && <div className="direct-text-overlay" aria-label="既存PDF文字の選択">{lines.map(line => <button key={line.id} aria-label={`既存文字: ${line.text}`} title={line.editable ? line.text : '縦書き・回転行は未対応'} disabled={!line.editable || busy} style={{ left: line.box[0] * scale, top: line.box[1] * scale, width: (line.box[2] - line.box[0]) * scale, height: (line.box[3] - line.box[1]) * scale }} onClick={() => { setSelection({ line, page, bytes }); setValue(line.text); setError(''); }} />)}</div>}
    {panel && createPortal(<div className="direct-controls">
      <p>横書きの文字行をクリックして変更します。スキャン画像・縦書き・回転行は対象外です。</p>
      {enabled && result?.bytes === bytes && result.page === page && !lines.length && <p role="status">選択できる文字情報がありません。スキャンPDFにはOCRが必要です。</p>}
      <button disabled={!past.length || busy} onClick={() => void travel(false)}>文字変更を元に戻す</button>
      <button disabled={!future.length || busy} onClick={() => void travel(true)}>文字変更をやり直す</button>
      <button disabled={busy} onClick={() => {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const a = window.document.createElement('a'); a.href = url; a.download = name.replace(/\.pdf$/i, '') + '-edited.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      }}>文字変更PDFをダウンロード</button>
      <p>この保存には追加した文字・画像・ハイライトは含みません。既存文字の変更履歴は最大10回です。</p>
      {error && <p role="alert">{error}</p>}
    </div>, panel)}
    {current && createPortal(<div className="direct-modal" role="dialog" aria-modal="true" aria-labelledby="direct-title"><form onSubmit={event => { event.preventDefault(); void apply(); }}>
      <h2 id="direct-title">既存の文字を変更</h2>
      <p>元の文字はPDF内部から削除されます。置換用フォントを使用するため字形は変わります。元の行幅内で1行ずつ変更してください。</p>
      <label>置換後の文字<textarea autoFocus rows={3} value={value} disabled={busy} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && !busy) setSelection(undefined); }} /></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} type="submit">{busy ? '変更中…' : 'PDFの文字を置換'}</button>
      <button disabled={busy} type="button" onClick={() => setSelection(undefined)}>キャンセル</button>
    </form></div>, window.document.body)}
  </>;
}
