# 勤怠チェックダッシュボード
小規模店舗のオーナー向けに、スタッフの勤怠状況を「見る・押す・直す」を最短でこなせる Next.js + Prisma 製アプリです。企画背景は `docs/planning.md` にあります。

## 何ができるか
- **管理者ダッシュボード**: 日付/範囲で打刻状況を一覧表示。
  - **異常検知**: 打刻漏れ、休憩不足、長時間労働、深夜勤務を自動判定。
  - **フィルタリング**: 「打刻異常」「休憩不足」などでスタッフを絞り込み可能。
  - **給与概算**: 時給×稼働時間＋残業（25%増）・深夜（25%増）手当を自動計算。
- **スタッフ一覧・詳細**: 直近7日と月次サマリー、概算給与、異常件数を確認。個別ページで日次の打刻・休憩・メモを確認。
- **従業員セルフ打刻**: ログインした本人が出勤・休憩開始/終了・退勤を押せる。
  - **ライブ時計**: 秒単位で現在時刻を表示するデジタル時計とアナログ時計。
  - **打刻修正**: 今日の打刻をモーダルで修正可能（HH:mm形式バリデーション付き）。
  - **履歴閲覧**: 直近14日の履歴を確認可能。
- **役割別ルーティング**: 管理者は `/admin` ダッシュボード、従業員は `/my` 打刻ページへ自動誘導。
- **セッション署名付き簡易ログイン**: 1時間TTLのセッションと Prisma/PostgreSQL でデータ管理。

## セットアップ
1) 環境変数を用意  
```bash
cp .env.example .env
# DATABASE_URL  : Postgres 接続文字列（直結 or Data Proxy 元のURL）
# AUTH_SECRET   : 長めのランダム文字列（セッショントークン署名用）
# PRISMA_ACCELERATE_URL (任意): Prisma Accelerate/Data Proxy を使う場合に設定
```

2) 依存関係・スキーマ・サンプルデータ  
```bash
npm install
npm run db:push   # スキーマ適用
npm run db:seed   # サンプルデータ投入（任意）
```

3) 開発サーバー起動  
```bash
npm run dev   # http://localhost:3000
```

## サンプルアカウント（seed）
- 管理者: `admin / adminpass`
- 従業員: `hanako / password`（山田花子に紐付け）
- 佐藤太郎は従業員として登録されていますが、User紐付けはしていません。ログインさせるには `User` に `employeeId` と `loginId/passwordHash/role: EMPLOYEE` を追加してください。

## 使い方の流れ
- **管理者**: `/login` → `/admin` ダッシュボードへ遷移。
  - 日付範囲を選択し、打刻状況や異常を確認。
  - 「打刻異常」「休憩不足」フィルタで問題のあるスタッフを抽出。
  - スタッフ名をクリックして詳細ページへ。
- **従業員**: `/login` → `/my` に遷移。  
  - **出勤前/退勤後**: 出勤ボタン or 修正。  
  - **勤務中**: 休憩開始、修正、退勤。  
  - **休憩中**: 休憩終了、修正。  
  - **修正**: 「本日の打刻を修正」からモーダルで出勤・休憩開始/終了・退勤・メモを手入力して保存。

## セキュリティメモ
- パスワードは scrypt + ソルトでハッシュ化。照合は timing-safe 比較。
- セッションは HMAC-SHA256 署名の httpOnly Cookie（1h TTL）。`AUTH_SECRET` は必ず十分長い乱数を設定。
- Prisma はプレースホルダーでクエリを発行。生SQLは使用していません。

## Prisma 接続について
- 直接接続: `DATABASE_URL` に Postgres 直結URLを設定（`PRISMA_ACCELERATE_URL` は空でOK）。
- Data Proxy / Accelerate: `PRISMA_ACCELERATE_URL` を設定すると Accelerate 経由で接続します（`DATABASE_URL` は元の接続文字列を指定）。

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
- ページ: `/admin` ダッシュボード、`/employees` スタッフ一覧、`/employees/[id]` 個別詳細、`/my` 従業員用ページ

## ドキュメント
- 企画・要件: `docs/planning.md`

## ライセンス
MIT License. 詳細は `LICENSE` を参照してください。
