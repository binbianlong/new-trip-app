---
description: "データベース操作、Supabaseクエリ、テーブル設計を行う際に使用。DB, database, テーブル, users, trips, trip_members, photos, notifications, クエリ, migration"
---
# データベース設計ガイド

DB関連の実装時は `docs/database.md` を参照してください。

## テーブル一覧

- **users** - ユーザー情報（id, username, profile_name, email, avatar_url）
- **trips** - 旅行情報（id, title, start_date, end_date, status, memo, owner_id）
  - status: `planned` / `started` / `finished`
- **trip_members** - 旅行参加者（trip_id, user_id, joined_at）
- **photos** - 写真情報（trip_id, user_id, image_url, taken_at, lat, lng）
- **notifications** - 通知情報（trip_id, type, scheduled_at, sent_at, status）

## 注意事項

- 全テーブルに `created_at`, `updated_at`, `deleted_at` カラムあり（論理削除対応）
- NOT NULL制約とオプション設定は実装時に確定する
