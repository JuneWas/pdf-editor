# PDF Studio

Next.js App Router / TypeScript / Tailwind CSS / PDF.js で構築したブラウザ型PDFビューアーの基盤です。

## 起動

Node.js 20.9以上（推奨24）とnpmを使用します。

```sh
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

依存関係は package-lock.json に固定しています。以後は `npm ci` で再現できます。

## 機能と構成

- ファイル選択・ドラッグ＆ドロップによる複数ページPDFの読み込み
- 前後移動、ページ番号・総ページ数、25〜300%のズーム
- 左側のクリック可能なサムネイル、中央のページ、右側の将来の編集領域
- ファイルは ArrayBuffer としてブラウザ内で処理。アップロードAPIや外部CDNは使用しません。
- PDF.js と Worker はクライアント専用コンポーネントに閉じ込め、Workerは `new URL(..., import.meta.url)` で同じアプリから配信します。ビルドにはWebpackを指定しています。
- 中央は選択ページのみを描画。サムネイルはIntersectionObserverによる遅延描画とReact.memoでズーム時の再描画を抑えます。未表示ページのcanvas描画は行いません（一覧DOM自体は全ページ分あります）。
- ファイル切替時は古いPDFタスクを破棄し、ページ切替時は描画をキャンセルします。

## 制限と確認項目

現在は表示機能の基盤で、編集・保存、テキスト選択、パスワード入力には未対応です。非常に大きなPDFはブラウザのメモリ制約を受けます。日本語フォント等の表示はPDF内の埋め込みフォントに依存します。

手動確認: 複数ページPDFを選択／ドロップし、サムネイル・前後移動・ズーム・別ファイルへの切替を確認してください。壊れたPDF、パスワード付きPDF、非PDFのエラー表示も確認してください。開発者ツールのNetworkでPDFが外部送信されないことを確認できます。
