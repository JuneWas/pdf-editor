import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'PDF Studio', description: 'ブラウザ内でPDFを表示するプライベートなワークスペース' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
