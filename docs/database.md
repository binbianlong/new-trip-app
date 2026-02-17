# データベース設計

> NOT NULL 制約と OPTIONS は要検討

## 🧑 users

| column name  | type         | memo           |
| ------------ | ------------ | -------------- |
| id           | uuid         | ID             |
| username     | text         | 一意に識別     |
| profile_name | text         | 表示名         |
| email        | text         | メールアドレス |
| avatar_url   | text         | アイコン画像URL |
| created_at   | timestamptz  | 作成日時       |
| updated_at   | timestamp    |                |
| deleted_at   | timestamp    |                |

## 🧳 trips

| column name  | type         | memo                                        |
| ------------ | ------------ | ------------------------------------------- |
| id           | uuid         | 旅行ID                                      |
| title        | text         | 旅行タイトル                                |
| start_date   | date         | 開始日                                      |
| end_date     | date         | 終了日                                      |
| status       | text         | 旅行状態（planned / started / finished）    |
| memo         | text         | メモ                                        |
| owner_id     | uuid         | 作成者ユーザーID                            |
| created_at   | timestamptz  | 作成日時                                    |
| updated_at   | timestamp    |                                             |
| deleted_at   | timestamp    |                                             |

## 👥 trip_members

| column name  | type         | memo             |
| ------------ | ------------ | ---------------- |
| id           | uuid         | ID               |
| trip_id      | uuid         | 旅行ID           |
| user_id      | uuid         | 参加ユーザーID   |
| joined_at    | timestamptz  | 参加日時         |
| created_at   | timestamptz  | 作成日時         |
| updated_at   | timestamp    |                  |
| deleted_at   | timestamp    |                  |

## 📸 photos

| column name  | type             | memo             |
| ------------ | ---------------- | ---------------- |
| id           | uuid             | 写真ID           |
| trip_id      | uuid             | 旅行ID           |
| user_id      | uuid             | 投稿ユーザーID   |
| image_url    | text             | 画像URL          |
| taken_at     | timestamptz      | 撮影時刻         |
| lat          | double precision | 緯度             |
| lng          | double precision | 経度             |
| created_at   | timestamptz      | 作成日時         |
| updated_at   | timestamp        |                  |
| deleted_at   | timestamp        |                  |

## 🔔 notifications

| column name   | type         | memo           |
| ------------- | ------------ | -------------- |
| id            | uuid         | 通知ID         |
| trip_id       | uuid         | 旅行ID         |
| type          | text         | 通知タイプ     |
| scheduled_at  | timestamptz  | 送信予定時刻   |
| sent_at       | timestamptz  | 実際の送信時刻 |
| status        | text         | 通知状態       |
| created_at    | timestamptz  | 作成日時       |
| updated_at    | timestamp    |                |
| deleted_at    | timestamp    |                |
