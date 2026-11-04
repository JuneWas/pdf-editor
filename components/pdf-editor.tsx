'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

// Bundled and served from this application's origin; no CDN or PDF upload.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const PageCanvas = memo(function PageCanvas({ document, page, scale, thumbnail = false }: { document: PDFDocumentProxy; page: number; scale: number; thumbnail?: boolean }) {
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
  }, [document, page, scale, thumbnail, visible]);
  return <div ref={host} className={thumbnail ? 'thumb-paper' : 'paper'}>{error ? <p role="alert">{error}</p> : <canvas ref={canvas} aria-label={`${page}ページ目`} role="img" />}</div>;
});

export default function PdfEditor() {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
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
  const load = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') { setError('PDFファイルを選択してください。'); return; }
    const id = ++generation.current;
    setLoading(true); setError(''); setDocument(null);
    const previous = activeTask.current;
    activeTask.current = null;
    try {
      await previous?.destroy();
      if (id !== generation.current) return;
      const data = await file.arrayBuffer();
      if (id !== generation.current) return;
      const task = pdfjs.getDocument({ data });
      activeTask.current = task;
      const next = await task.promise;
      if (id !== generation.current) { await task.destroy(); return; }
      setDocument(next); setName(file.name); setPage(1); setScale(1);
    } catch (reason) {
      if (id === generation.current) setError(reason instanceof Error && reason.name === 'PasswordException' ? 'パスワード付きPDFにはまだ対応していません。' : 'PDFを読み込めませんでした。ファイルが破損していないか確認してください。');
    } finally { if (id === generation.current) setLoading(false); }
  }, []);
  return <div className="studio" onDragOver={event => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void load(file); }}>
    <header className="toolbar">
      <div className="brand"><span className="brand-icon">P</span><div>PDF Studio<small>YOUR PRIVATE WORKSPACE</small></div></div>
      <div className="filename" title={name}>{name || '新しいドキュメント'}</div>
      <div className="zoom"><button disabled={!document || scale <= .25} onClick={() => setScale(value => Math.max(.25, value - .25))} aria-label="縮小">−</button><span>{Math.round(scale * 100)}%</span><button disabled={!document || scale >= 3} onClick={() => setScale(value => Math.min(3, value + .25))} aria-label="拡大">＋</button></div>
      <button className="primary" onClick={() => input.current?.click()}>↑ PDFを開く</button>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="PDFファイルを選択" onChange={event => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = ''; }} />
    </header>
    <aside className="pages"><h2>ページ <span>{document?.numPages || 0}</span></h2><div className="thumbnails">{document ? Array.from({ length: document.numPages }, (_, index) => <button key={`${document.fingerprints[0]}-${index}`} className={`thumbnail ${page === index + 1 ? 'selected' : ''}`} aria-label={`${index + 1}ページへ移動`} aria-current={page === index + 1 ? 'page' : undefined} onClick={() => setPage(index + 1)}><PageCanvas document={document} page={index + 1} scale={1} thumbnail /><span>{index + 1}</span></button>) : <p className="muted">ページ一覧がここに表示されます</p>}</div></aside>
    <main className="viewer"><div className="status" aria-live="polite">{loading && 'PDFを読み込み中…'}{error && <p role="alert">{error}</p>}</div>{document ? <div className="document"><PageCanvas key={`${document.fingerprints[0]}-${page}-${scale}`} document={document} page={page} scale={scale} /></div> : !loading && <div className="empty"><div className="file-icon">▤</div><p className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</p><h1>PDFから、はじめよう。</h1><p>ファイルをここにドラッグ＆ドロップ<br />または、ボタンからPDFを選択してください。</p><button className="primary" onClick={() => input.current?.click()}>PDFファイルを選択</button><small>🔒 ファイルはブラウザ内だけで処理されます</small></div>}
    <nav className="pagination" aria-label="ページ移動"><button aria-label="前のページ" disabled={!document || page <= 1} onClick={() => setPage(value => value - 1)}>←</button><span>{document ? page : 0} <span className="muted">/ {document?.numPages || 0}</span></span><button aria-label="次のページ" disabled={!document || page >= document.numPages} onClick={() => setPage(value => value + 1)}>→</button></nav></main>
    <aside className="properties"><h2>プロパティ</h2><span className="badge">COMING SOON</span><h3>編集のためのスペース</h3><p>テキストや注釈などの編集プロパティがここに表示されます。</p><div className="privacy"><strong>あなたのファイルは、あなたの手元に。</strong><p>PDFを外部サーバーへ送信することはありません。</p></div></aside>
    <footer>PDF STUDIO <span>ローカル処理 · プライバシーを大切に</span></footer>{dragging && <div className="drop-overlay">PDFをドロップして開く</div>}
  </div>;
}
