# PDF Studio

Next.js App Router / TypeScript / Tailwind CSS / PDF.js で構築したブラウザ型PDFビューアーの基盤です。

## 起動

Node.js 20.9以上（推奨24）とnpmを使用します。

```sh
npm ci
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

文字・画像・ハイライトを追加する編集レイヤーに対応しています。既存PDF内の文字は変更しません。PDF書き出し・永続保存、テキスト選択、パスワード入力には未対応です。非常に大きなPDFはブラウザのメモリ制約を受けます。日本語フォント等の表示はPDF内の埋め込みフォントに依存します。

手動確認: 複数ページPDFを選択／ドロップし、サムネイル・前後移動・ズーム・別ファイルへの切替を確認してください。壊れたPDF、パスワード付きPDF、非PDFのエラー表示も確認してください。開発者ツールのNetworkでPDFが外部送信されないことを確認できます。

## GitHub Pagesで公開

1. 公開したい変更をPull Requestで `main` にマージします。
2. GitHubのリポジトリ **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
3. **Actions → Deploy GitHub Pages** の実行を確認します。必要なら **Run workflow** で `main` を選んで再実行します。
4. 成功後、`https://junewas.github.io/pdf-editor/` を開きます。

Actionsは `GITHUB_PAGES=true` でビルドし、`/pdf-editor` 配下向けの静的ファイルを `out/` に出力します。PDF処理とWorkerはブラウザ内で動き、サーバーの実行は不要です。通常の `npm run dev` と `npm run build` は従来どおりルートパスを使用します。

公開にはリポジトリのPages設定権限が必要です。非公開リポジトリの場合は、GitHubプランがPagesに対応している必要があります。

## 開発を再開する

最初に [AGENTS.md](AGENTS.md) の開発ルールと [PROGRESS.md](PROGRESS.md) の進捗・次のタスクを読んでください。会話の履歴ではなく、このリポジトリと実際のコードを基準に再開します。

```sh
git clone https://github.com/JuneWas/pdf-editor.git
cd pdf-editor
npm ci
npm run dev
```

Windows PowerShellで実行ポリシーによりnpmが拒否された場合は `npm.cmd ci` と `npm.cmd run dev` を使います。サーバーを起動したターミナルを開いたまま、同じPCのブラウザからアクセスしてください。クラウド環境のlocalhostは手元のPCから直接開けません。

## 技術構成と主要ファイル

- Next.js 16 / React 19 / TypeScript（strict）/ Tailwind CSS 4 / pdfjs-dist 5。正確な依存バージョンは `package-lock.json` を参照。
- `app/page.tsx`: SSRを無効にしたPDF画面の動的読み込み。
- `components/pdf-editor.tsx`: PDFの読み込み、Worker設定、canvas描画、サムネイルと画面操作。
- `app/layout.tsx`, `app/globals.css`: メタデータとレスポンシブな画面構成。
- `next.config.mjs`: 通常起動とGitHub Pages用静的出力の切り替え。
- `.github/workflows/pages.yml`: main更新時に検証・静的ビルド・Pagesへのデプロイ。

バックエンド、データベース、APIキーは不要です。Pages用の `out/` は静的ホスティング用で、`npm start` の対象ではありません。

## 追加要素の編集

右側で「文字を追加」または「ハイライトを追加」を選び、PDF上をクリックします。「選択・移動」で要素をドラッグできます。文字の内容・サイズ・色、ハイライトの色・不透明度はプロパティで編集して「変更を適用」を押してください。日本語入力はHTML textareaを使用します。

「画像を追加」でPNG/JPEG/WebPを読み込みます。画像・ハイライトは選択枠をドラッグしてサイズ変更できます。要素はcanvasまたは右側の一覧から選択し、削除できます。Undo/Redoは全ページ共通で最大100操作を保持します。ページ移動・ズームは履歴に含みません。

編集内容はReactの状態だけに保持され、PDF切替・再読み込みで失われます。サムネイルは元PDFのみを表示します。

- `lib/edit-state.ts`: ページ別オブジェクトと履歴の純粋Reducer。一意ID、PDFのネイティブ座標のアンカー、PDF単位のサイズを保存。
- `components/edit-layer.tsx`: react-konva / konvaによる別canvas。PDF.jsのviewport変換でCropBox・ページ回転を反映し、ズームは描画時だけ適用。要素自体は表示ページに対して水平に配置。
- `components/edit-properties.tsx`: 日本語対応入力と選択要素のプロパティ。

### 編集機能のテスト

Node.js 24で `npm test` を実行します。ブラウザテストは `npx playwright install chromium` 後、別ターミナルで `npm run dev -- --port 3003` を起動し、`npm run test:browser` を実行します。既存Chromiumを使う場合は `CHROMIUM_PATH`、別URLでは `TEST_URL` を環境変数で指定できます。合成した非機密PDFを使います。
