'use client';
import dynamic from 'next/dynamic';
const PdfEditor = dynamic(() => import('@/components/pdf-editor'), { ssr: false, loading: () => <p className="p-8">ワークスペースを準備中…</p> });
export default function Home() { return <PdfEditor />; }
