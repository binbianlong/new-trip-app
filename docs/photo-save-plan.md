# 写真撮影 → DB保存 → UI表示 実装計画

## 現状分析

### フロントエンド（`app/trip/active.tsx`）

| 処理 | 状態 | 備考 |
|---|---|---|
| カメラ起動・撮影 | **実装済み** | `ImagePicker.launchCameraAsync` |
| 位置情報取得 | **実装済み** | `Location.getCurrentPositionAsync` |
| Supabase Storage アップロード | **実装済み** | `expo-file-system` で ArrayBuffer 変換 → upload |
| `photos` テーブル INSERT | **実装済み** | `trip_id`, `user_id`, `image_url`, `lat`, `lng` |
| 保存後にデータ再取得 | **実装済み** | `fetchTripData()` で photos を再取得 |
| 地図上にピン表示 | **実装済み** | `photos` state → `Marker` で丸型サムネイル表示 |
| 保存中 UI | **実装済み** | `isSaving` + `ActivityIndicator` |
| エラー/成功フィードバック | **実装済み** | `Alert.alert` で通知 |

### Supabase 側

| 項目 | 状態 | 対応 |
|---|---|---|
| `photos` テーブル | **存在する** | `id`, `user_id`, `trip_id`, `image_url`, `lat`, `lng`, `created_at` 等 |
| Storage `photos` バケット | **要確認** | 未作成の場合アップロードが失敗する |
| Storage INSERT ポリシー | **要確認** | authenticated が upload できる必要あり |
| Storage SELECT ポリシー | **要確認** | public URL でアクセスするなら public SELECT が必要 |
| `photos` テーブル INSERT ポリシー | **要確認** | `auth.uid() = user_id` で INSERT 許可 |
| `photos` テーブル SELECT ポリシー | **要確認** | 旅行メンバーが SELECT できる必要あり |
| `trips` テーブル SELECT ポリシー | **要確認** | 前回 `ownedTrips: []` が返っていた → ポリシー未設定の可能性 |
| `trips` テーブル UPDATE ポリシー | **要確認** | 旅行開始/終了でステータス変更に必要 |

## ブロッカー（これが無いと動かない）

### 1. Supabase Storage `photos` バケット
ダッシュボード → Storage → バケット一覧に `photos` が存在するか確認。
なければ作成（Public bucket: ON）。

### 2. RLS ポリシー
以下を **SQL Editor でまとめて実行** すれば全て解決する:

既存のポリシーがあるとエラーになるため、`DO $$ ... $$` ブロックで存在チェックしてからCREATEする。
**SQL Editor に以下をそのまま貼り付けて実行する。**

```sql
-- ===== Storage =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload photos' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access for photos' AND tablename = 'objects') THEN
    CREATE POLICY "Public read access for photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'photos');
  END IF;
END $$;

-- ===== photos テーブル =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own photos' AND tablename = 'photos') THEN
    CREATE POLICY "Users can insert own photos" ON public.photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view photos' AND tablename = 'photos') THEN
    CREATE POLICY "Authenticated users can view photos" ON public.photos FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ===== trips テーブル =====
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own trips' AND tablename = 'trips') THEN
    CREATE POLICY "Users can view own trips" ON public.trips FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own trips' AND tablename = 'trips') THEN
    CREATE POLICY "Users can update own trips" ON public.trips FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create trips' AND tablename = 'trips') THEN
    CREATE POLICY "Users can create trips" ON public.trips FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;
```

## 実装手順

### Step 1: Supabase 側セットアップ（ダッシュボード操作）

1. Storage に `photos` バケットが存在するか確認 → なければ作成（Public: ON）
2. 上記の SQL を SQL Editor で実行して RLS ポリシーを設定
3. 既存のポリシーと重複する場合はエラーになるので、重複分はスキップ

### Step 2: 動作確認（実機テスト）

1. `npx expo start` でアプリ起動
2. ログインしてホーム画面で旅行が表示されるか確認
3. 旅行を開始して旅行中画面へ遷移
4. カメラボタンで撮影 → 「保存完了」Alert が出るか確認
5. 撮影後、地図上に写真ピンが表示されるか確認
6. Supabase ダッシュボードで確認:
   - Storage → `photos` バケット → ファイルが存在し、サイズが 0 より大きいか
   - Table Editor → `photos` テーブル → レコードが存在し、`image_url`, `lat`, `lng` が入っているか

### Step 3: フロントの追加改善（必要に応じて）

- [ ] 撮影後に地図を撮影地点にアニメーション移動
- [ ] 写真ピンタップで拡大表示
- [ ] 保存中のオーバーレイ表示（画面全体の半透明マスク）

## フロー図

```
[カメラボタン押下]
    ↓
[権限チェック（カメラ + 位置情報）]
    ↓
[カメラ起動 → 撮影]
    ↓
[GPS取得（高精度）]
    ↓
[isSaving = true]
    ↓
[expo-file-system で画像を ArrayBuffer に変換]
    ↓
[Supabase Storage にアップロード]
    ↓ 成功
[public URL を取得]
    ↓
[photos テーブルに INSERT]
    ↓ 成功
[fetchTripData() で photos を再取得]
    ↓
[photos state が更新 → Marker が再描画]
    ↓
[地図上に新しい写真ピンが表示される]
    ↓
[isSaving = false, Alert「保存完了」]
```

## 結論

**フロントエンドのコードは完成している。**
Supabase 側の設定（Storage バケット作成 + RLS ポリシー設定）が完了すれば、
写真撮影 → DB 保存 → 地図上にピン表示 の一連のフローが動作する。
