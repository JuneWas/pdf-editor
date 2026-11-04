# 開発ガイド

## 作業を始めるとき

1. README.mdとPROGRESS.mdを読み、コード・git status・現在のブランチで記録の整合性を確認する。
2. 既存の変更を保護する。クラウドタスクは既に隔離されているため、ユーザーが求めない限りworktreeを作らない。
3. mainから作業ブランチを作り、PRで変更を取り込む。mainへ直接pushしない。
4. 必要なら `npm ci`。環境や認証が前回と同じとは仮定せず、実際のコマンドで確認する。

## 開発方針・コーディング規約

- PDFはブラウザ内で処理する。外部へのファイル送信や外部CDNを導入しない。
- GitHub Pagesの静的出力と `/pdf-editor/` のbasePathを維持する。サーバー必須機能は設計変更として相談する。
- TypeScript strictを維持し、型を明示する。不要なany、型エラー抑制、lint無効化で問題を隠さない。
- 関数コンポーネントとHooksを使う。ブラウザAPIとPDF.jsはクライアント側に限定し、Workerの同一オリジン配信を維持する。
- 非同期処理には競合防止と後始末を実装する。文書の破棄と描画キャンセルを保ち、サムネイルをズーム等で不要に再描画しない。
- UIは日本語とし、操作にはアクセシブルな名前、キーボードフォーカス、無効状態、読込中・エラー表示を用意する。
- 既存の命名と構成に合わせる。大きな変更では責務を分け、無関係な整形や依存更新を混ぜない。
- 依存更新時はpackage-lock.jsonも更新する。秘密情報、実ユーザーのPDF、node_modules、.next、outをコミットしない。

## テスト方針

- コード変更時は `npm run lint`、`npm run build`、`npm run typecheck` を実行する。新規checkoutでは型生成を伴うbuildをtypecheckより先に実行できる。
- 配信・Worker・ルーティング変更時は `GITHUB_PAGES=true npm run build` でも検証する（PowerShell: `$env:GITHUB_PAGES="true"; npm run build`、終了後 `Remove-Item Env:GITHUB_PAGES`）。
- 表示変更では非機密の複数ページPDFで、選択・ドロップ・前後移動・サムネイル・ズーム・ファイル切替を確認する。
- 壊れたPDF、パスワード付きPDF、非PDF、連続操作を対象にする。PDF送信がないこととWorkerの読み込みも確認する。
- 挙動変更や不具合修正には可能な範囲で再現性のあるテストを加える。現在はリポジトリ内に自動ブラウザテストがないため、手動確認と自動検証を区別する。
- 実行結果を正確に記録する。未実行・環境での失敗・アプリの失敗を成功扱いしない。

## 進捗の引き継ぎ

機能追加、不具合発見・解消、検証、公開、方針変更の区切りでPROGRESS.mdを更新する。実装済み／未実装／既知の問題／次のタスク／検証結果を現状に合わせ、古い記述を修正する。更新日、検証範囲と未確認事項を残す。ローカル環境固有の一時パスや会話履歴がなくても理解できるように書く。

完了報告では変更ファイル、検証結果、残課題、commit/push/PR/公開のどこまで完了したかを区別する。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
