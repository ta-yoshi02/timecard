# 勤怠チェックダッシュボード
小規模飲食店オーナー向けに、日別の打刻状況と異常を素早く確認できる Next.js + Mantine 製の勤怠ビューアです。企画・背景は `docs/planning.md` にまとまっています。

## 特徴
- 日別/範囲の勤怠ダッシュボード（DatePicker、打刻漏れ・長時間勤務・休憩不足・深夜勤務バッジ、クイックフィルタ）
- 打刻異常アラート抽出（「打刻異常」「残業が多い」フィルタ）
- スタッフ一覧と個別詳細（月単位の打刻履歴、休憩時間表示、深夜勤務ハイライト、概算給与表示）
- 時給を従業員情報に保持し、表示範囲の概算給与を算出
- Prisma + PostgreSQL を利用したデータ管理。`prisma/seed.js` でサンプルデータ投入可能。

## セットアップ
1. Node.js と PostgreSQL を用意し、接続文字列を `.env` に設定
   ```bash
   cp .env.example .env
   # .env 内の DATABASE_URL を PostgreSQL 接続文字列に変更
   ```
2. 依存関係とスキーマを適用（`npm install` と `npm run build` で Prisma Client を生成します）
   ```bash
   npm install
   npm run db:push      # Prisma スキーマ反映
   npm run db:seed      # サンプルデータ投入（任意）
   ```
3. 開発サーバーを起動
   ```bash
   npm run dev          # http://localhost:3000
   ```

## スクリプト
- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`
- `npm run db:generate` / `npm run db:push` / `npm run db:seed`

## デプロイ (Vercel)
1. リポジトリを GitHub 等にプッシュ
2. Vercel の New Project からインポートし、Framework で Next.js を選択
3. 環境変数に `DATABASE_URL`（Vercel Postgres などの接続文字列）を設定
4. 必要に応じて `npm run db:seed` を手動実行して初期データを投入

## 技術スタックと構成
- Next.js App Router (16) / TypeScript / Mantine 8
- レイアウト: `app/components/AppLayout.tsx` (AppShell + ナビゲーション)
- データ/ロジック: Prisma (`lib/prisma.ts`, `prisma/schema.prisma`, `prisma/seed.js`)、型は `lib/types.ts`、集計は `lib/attendance.ts`
- API: `app/api/attendance`, `app/api/employees`, `app/api/employees/[id]/records`
- ページ: `/` ダッシュボード、`/employees` スタッフ一覧、`/employees/[id]` 個別詳細

## ドキュメント
- 企画・要件: `docs/planning.md`

## ライセンス
MIT License. 詳細は `LICENSE` を参照してください。
