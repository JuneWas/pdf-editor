'use client';

import { memo, useCallback, useEffect, useRef, useState, useReducer } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask, PageViewport } from 'pdfjs-dist';

import DirectTextEditor from './direct-text-editor';
import EditLayer from './edit-layer';
import EditProperties from './edit-properties';
import { editReducer, initialHistory, type EditObject } from '@/lib/edit-state';

// Bundled and served from this application's origin; no CDN or PDF upload.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const PageCanvas = memo(function PageCanvas({ document, page, scale, thumbnail = false, onViewport }: { document: PDFDocumentProxy; page: number; scale: number; thumbnail?: boolean; onViewport?: (viewport: PageViewport) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!thumbnail);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!thumbnail || !host.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [thumbnail]);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    // Render to a private canvas, so rapid zoom/page changes cannot reuse a busy canvas.
    const output = window.document.createElement('canvas');
    void (async () => {
      const pdfPage = await document.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      onViewport?.(base);
      const viewport = pdfPage.getViewport({ scale: thumbnail ? 120 / base.width : scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      output.width = Math.ceil(viewport.width * ratio);
      output.height = Math.ceil(viewport.height * ratio);
      task = pdfPage.render({ canvas: output, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
      if (cancelled || !canvas.current) return;
      canvas.current.width = output.width;
      canvas.current.height = output.height;
      canvas.current.style.width = `${viewport.width}px`;
      canvas.current.style.height = `${viewport.height}px`;
      canvas.current.getContext('2d')?.drawImage(output, 0, 0);
    })().catch((reason: unknown) => {
      if (!cancelled && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) setError('このページを表示できません。');
    });
    return () => { cancelled = true; task?.cancel(); };
  }, [document, page, scale, thumbnail, visible, onViewport]);
  return <div ref={host} className={thumbnail ? 'thumb-paper' : 'paper'}>{error ? <p role="alert">{error}</p> : <canvas ref={canvas} aria-label={`${page}ページ目`} role="img" />}</div>;
});

export default function PdfEditor() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array<ArrayBuffer> | null>(null);
  const [directMode, setDirectMode] = useState(false);
  const [session, setSession] = useState(0);
  const [revision, setRevision] = useState(0);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [history, dispatch] = useReducer(editReducer, initialHistory);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'text' | 'highlight'>('select');
  const [geometry, setGeometry] = useState<{ page: number; viewport: PageViewport } | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const activeTask = useRef<ReturnType<typeof pdfjs.getDocument> | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; void activeTask.current?.destroy(); }, []);
  const objects = history.present[page] || [];
  const selectedItem = objects.find(item => item.id === selected);
  const onViewport = useCallback((viewport: PageViewport) => setGeometry({ page, viewport }), [page]);
  const changeObjects = (items: EditObject[]) => dispatch({ type: 'set', page, objects: items });
  const add = (x: number, y: number) => {
    const item: EditObject = { id: `edit-${crypto.randomUUID()}`, kind: tool === 'highlight' ? 'highlight' : 'text', x, y, width: 180, height: tool === 'highlight' ? 30 : 100, text: 'テキスト', fontSize: 24, color: tool === 'highlight' ? '#ffe066' : '#202020', opacity: .35 };
    changeObjects([...objects, item]); setSelected(item.id); setTool('select');
  };
  const load = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') { setError('PDFファイルを選択してください。'); return; }
    const id = ++generation.current;
    setPdfBytes(null); setDirectMode(false); setSession(id); setRevision(0);
    setLoading(true); setError(''); setDocument(null); setGeometry(null); dispatch({ type: 'reset' }); setSelected(null); setTool('select');
    const previous = activeTask.current;
    activeTask.current = null;
    try {
      await previous?.destroy();
      if (id !== generation.current) return;
      const data = await file.arrayBuffer();
      if (id !== generation.current) return;
      const retained = new Uint8Array(data.slice(0));
      const task = pdfjs.getDocument({ data });
      activeTask.current = task;
      const next = await task.promise;
      if (id !== generation.current) { await task.destroy(); return; }
      setDocument(next); setPdfBytes(retained); setName(file.name); setPage(1); setScale(1);
    } catch (reason) {
      if (id === generation.current) setError(reason instanceof Error && reason.name === 'PasswordException' ? 'パスワード付きPDFにはまだ対応していません。' : 'PDFを読み込めませんでした。ファイルが破損していないか確認してください。');
    } finally { if (id === generation.current) setLoading(false); }
  }, []);
  const replacePdf = async (data: Uint8Array<ArrayBuffer>) => {
    const id = generation.current;
    const task = pdfjs.getDocument({ data: data.slice() });
    try {
      const next = await task.promise;
      if (id !== generation.current) { await task.destroy(); return false; }
      const previous = activeTask.current; activeTask.current = task;
      setDocument(next); setPdfBytes(data); setRevision(value => value + 1); setError('');
      void previous?.destroy();
      return true;
    } catch { await task.destroy(); if (id === generation.current) setError('変更後のPDFを表示できませんでした。元のPDFを維持します。'); return false; }
  };
  return <div className="studio" onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void load(file); }}>
    <header className="toolbar">
      <div className="brand"><span className="brand-icon">P</span><div>PDF Studio<small>YOUR PRIVATE WORKSPACE</small></div></div>
      <div className="filename" title={name}>{name || '新しいドキュメント'}</div>
      <div className="zoom"><button disabled={!document || scale <= .25} onClick={() => setScale(value => Math.max(.25, value - .25))} aria-label="縮小">−</button><span>{Math.round(scale * 100)}%</span><button disabled={!document || scale >= 3} onClick={() => setScale(value => Math.min(3, value + .25))} aria-label="拡大">＋</button></div>
      <button className="primary" onClick={() => input.current?.click()}>↑ PDFを開く</button>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="PDFファイルを選択" onChange={event => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = ''; }} />
    </header>
    <aside className="pages"><h2>ページ <span>{document?.numPages || 0}</span></h2><div className="thumbnails">{document ? Array.from({ length: document.numPages }, (_, index) => <button key={`${revision}-${document.fingerprints[0]}-${index}`} className={`thumbnail ${page === index + 1 ? 'selected' : ''}`} aria-label={`${index + 1}ページへ移動`} aria-current={page === index + 1 ? 'page' : undefined} onClick={() => setPage(index + 1)}><PageCanvas document={document} page={index + 1} scale={1} thumbnail /><span>{index + 1}</span></button>) : <p className="muted">ページ一覧がここに表示されます</p>}</div></aside>
    <main className="viewer"><div className="status" aria-live="polite">{loading && 'PDFを読み込み中…'}{error && <p role="alert">{error}</p>}</div>{document ? <div className="document"><div className="page-stack"><PageCanvas key={`${revision}-${document.fingerprints[0]}-${page}-${scale}`} document={document} page={page} scale={scale} onViewport={onViewport} />{geometry?.page === page && !directMode && <EditLayer viewport={geometry.viewport} scale={scale} objects={objects} selected={selected} onSelect={setSelected} onChange={changeObjects} tool={tool} onAdd={add} />}{pdfBytes && <DirectTextEditor key={session} bytes={pdfBytes} page={page} scale={scale} enabled={directMode} name={name} onReplace={replacePdf} />}</div></div> : !loading && <div className="empty"><div className="file-icon">▤</div><p className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</p><h1>PDFから、はじめよう。</h1><p>ファイルをここにドラッグ＆ドロップ<br />または、ボタンからPDFを選択してください。</p><button className="primary" onClick={() => input.current?.click()}>PDFファイルを選択</button><small>🔒 ファイルはブラウザ内だけで処理されます</small></div>}
    <nav className="pagination" aria-label="ページ移動"><button aria-label="前のページ" disabled={!document || page <= 1} onClick={() => setPage(value => value - 1)}>←</button><span>{document ? page : 0} <span className="muted">/ {document?.numPages || 0}</span></span><button aria-label="次のページ" disabled={!document || page >= document.numPages} onClick={() => setPage(value => value + 1)}>→</button></nav></main>
    <aside className="properties"><button disabled={!document} aria-pressed={directMode} onClick={() => setDirectMode(value => !value)}>既存文字を編集</button><div id="direct-panel" /><h2>編集プロパティ</h2><div className="edit-tools">
      <button disabled={!document} aria-pressed={tool === 'select'} onClick={() => { setTool('select'); setDirectMode(false); }}>選択・移動</button>
      <button disabled={!document} aria-pressed={tool === 'text'} onClick={() => { setTool('text'); setDirectMode(false); }}>文字を追加</button>
      <button disabled={!document} aria-pressed={tool === 'highlight'} onClick={() => { setTool('highlight'); setDirectMode(false); }}>ハイライトを追加</button>
      <button disabled={!document || geometry?.page !== page} onClick={() => imageInput.current?.click()}>画像を追加</button>
      <button disabled={!history.past.length} onClick={() => { dispatch({ type: 'undo' }); setSelected(null); }}>Undo</button>
      <button disabled={!history.future.length} onClick={() => { dispatch({ type: 'redo' }); setSelected(null); }}>Redo</button>
      <input ref={imageInput} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" aria-label="画像ファイルを選択" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file || !geometry || !document) return;
        const id = generation.current; const targetPage = page;
        try {
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('unsupported');
          const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
          const bitmap = new Image(); bitmap.src = src; await bitmap.decode();
          if (id !== generation.current) return;
          const [x, y] = geometry.viewport.convertToPdfPoint(30, 30);
          const item: EditObject = { id: `edit-${crypto.randomUUID()}`, kind: 'image', x, y, width: 150, height: 150 * bitmap.height / bitmap.width, text: '', fontSize: 24, color: '#000000', opacity: 1, src };
          dispatch({ type: 'append', page: targetPage, item }); setSelected(item.id); setTool('select');
        } catch { setError('画像を読み込めません。PNG・JPEG・WebPを選択してください。'); }
      }} />
    </div><p>{tool === 'select' ? '要素を選択してドラッグできます。' : 'PDF上をクリックして追加してください。'}</p>
    {selectedItem && <EditProperties key={JSON.stringify(selectedItem)} item={selectedItem} onSave={item => changeObjects(objects.map(old => old.id === item.id ? item : old))} onDelete={() => { changeObjects(objects.filter(item => item.id !== selected)); setSelected(null); }} />}
    <div className="object-list" aria-label="追加した要素">{objects.map((item, index) => <button key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{index + 1}: {item.kind === 'text' ? item.text || '空の文字' : item.kind === 'image' ? '画像' : 'ハイライト'}</button>)}</div>
    <p>編集はこの画面内のみです。別のPDFを開く・再読み込みすると失われます。追加要素のPDF書き出しは未対応です。既存文字の変更はダウンロードで保存できます。</p></aside>
    <footer>PDF STUDIO <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/source.tar.gz`}>ソースを取得 (AGPL-3.0+)</a><a href="https://github.com/JuneWas/pdf-editor">GitHub</a><span>ローカル処理 · プライバシーを大切に</span></footer>{dragging && <div className="drop-overlay">PDFをドロップして開く</div>}
  </div>;
}
