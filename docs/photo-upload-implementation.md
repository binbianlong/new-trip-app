# 写真撮影 → Supabase 保存 実装状況と手順

## 現状まとめ

### 実装済み（フロントエンド）

`app/trip/active.tsx` に以下のフローが**コードとして既に存在**する。

| 処理 | 状況 | 該当コード |
|---|---|---|
| カメラ権限リクエスト | 実装済み | `ImagePicker.requestCameraPermissionsAsync()` |
| 位置情報権限リクエスト | 実装済み | `Location.requestForegroundPermissionsAsync()` |
| カメラ起動・撮影 | 実装済み | `ImagePicker.launchCameraAsync({ quality: 0.8 })` |
| 撮影時の緯度経度取得 | 実装済み | `Location.getCurrentPositionAsync({ accuracy: High })` |
| Supabase Storage へ画像アップロード | 実装済み | `supabase.storage.from("photos").upload(fileName, formData)` |
| `photos` テーブルへ INSERT | 実装済み | `supabase.from("photos").insert(...)` |
| アップロード後の地図ピン更新 | 実装済み | `fetchTripData()` で再取得 |
| 保存中の UI フィードバック | 実装済み | `isSaving` state + `ActivityIndicator` |
| `app.json` のプラグイン設定 | 実装済み | `expo-image-picker`, `expo-location` |

### フロントエンドの処理フロー（実装済み）

```
カメラボタン押下
  ↓
カメラ権限チェック（未許可なら Alert で中断）
  ↓
位置情報権限チェック（未許可なら Alert で中断）
  ↓
カメラ起動 → 撮影
  ↓
現在地取得（GPS 高精度）
  ↓
savePhoto() 呼び出し
  ├─ Supabase Storage に画像アップロード
  │   ファイルパス: {trip_id}/{timestamp}.jpg
  │   バケット名: "photos"
  ├─ アップロード成功 → public URL を取得
  ├─ photos テーブルに INSERT
  │   { trip_id, user_id, image_url, lat, lng }
  └─ fetchTripData() でピン再描画
```

### 未設定 / 確認が必要な項目（Supabase 側）

| 項目 | 状況 | 対応 |
|---|---|---|
| Supabase Storage `photos` バケット | **要確認** | ダッシュボードで作成済みか確認 |
| バケットの公開設定 | **要確認** | `getPublicUrl` を使うため public にする必要あり |
| Storage の RLS ポリシー | **要確認** | authenticated ユーザーが INSERT できるポリシー |
| `photos` テーブルの RLS ポリシー | **要確認** | authenticated ユーザーが INSERT / SELECT できるポリシー |
| 認証（ログイン）機能 | **未実装** | `supabase.auth.getUser()` が null を返すと `savePhoto` は早期リターンする |
| 環境変数 `.env` | 設定済み | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

## 実装手順

### Step 1: Supabase Storage バケット作成

Supabase ダッシュボード（https://supabase.com/dashboard）で操作する。

1. 対象プロジェクトを開く
2. **Storage** → **New bucket**
3. バケット名: `photos`
4. **Public bucket**: ON（`getPublicUrl` で URL を取得するため）
5. **File size limit**: 10MB 程度（写真の品質 0.8 で十分）
6. 作成

### Step 2: Storage の RLS ポリシー設定

Supabase の Storage は内部的に `storage.objects` テーブルでファイルを管理しており、
RLS（Row Level Security）ポリシーでアクセス制御を行う。
バケットを作成しただけでは RLS が有効な状態のため、ポリシーを設定しないとすべての操作が拒否される。

#### 前提知識

- `storage.objects` テーブルの主要カラム:
  - `bucket_id`: バケット名（例: `"photos"`）
  - `name`: ファイルパス（例: `"trip-uuid/1234567890.jpg"`）
  - `owner`: アップロードしたユーザーの `auth.uid()`
- ポリシーの種類:
  - **SELECT**: ファイルのダウンロード / URL アクセス
  - **INSERT**: ファイルのアップロード
  - **UPDATE**: ファイルの上書き
  - **DELETE**: ファイルの削除

#### 設定手順（ダッシュボード GUI）

1. Supabase ダッシュボード → 左メニュー **Storage** をクリック
2. `photos` バケットをクリック
3. 上部タブの **Policies** をクリック
4. 以下の 3 つのポリシーをそれぞれ作成する

#### ポリシー 1: INSERT（アップロード許可）

ログイン済みユーザーが `photos` バケットにファイルをアップロードできるようにする。
フロントの `supabase.storage.from("photos").upload(...)` が成功するために必要。

**GUI での設定:**
- **Policy name**: `Authenticated users can upload photos`
- **Allowed operation**: INSERT
- **Target roles**: `authenticated`
- **WITH CHECK expression**:
```sql
bucket_id = 'photos'
```

**SQL エディタで実行する場合:**
```sql
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photos');
```

#### ポリシー 2: SELECT（ダウンロード / 閲覧許可）

写真の public URL にアクセスしたとき画像を表示できるようにする。
フロントの `getPublicUrl()` で取得した URL が実際に画像を返すために必要。
バケットを public にしている場合でも、RLS が有効ならこのポリシーが必要。

**GUI での設定:**
- **Policy name**: `Public read access for photos`
- **Allowed operation**: SELECT
- **Target roles**: `public`（全員）
- **USING expression**:
```sql
bucket_id = 'photos'
```

**SQL エディタで実行する場合:**
```sql
CREATE POLICY "Public read access for photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');
```

#### ポリシー 3: DELETE（削除許可 / 任意）

アップロードしたユーザー本人だけが自分のファイルを削除できるようにする。
現時点では削除機能は未実装だが、将来の拡張のために設定しておくとよい。

**GUI での設定:**
- **Policy name**: `Users can delete own photos`
- **Allowed operation**: DELETE
- **Target roles**: `authenticated`
- **USING expression**:
```sql
bucket_id = 'photos' AND owner = auth.uid()
```

**SQL エディタで実行する場合:**
```sql
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'photos' AND owner = auth.uid());
```

#### SQL エディタでまとめて実行する場合

ダッシュボード → 左メニュー **SQL Editor** → **New query** で以下を貼り付けて実行する。

```sql
-- Storage: アップロード許可
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photos');

-- Storage: 閲覧許可（public）
CREATE POLICY "Public read access for photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

-- Storage: 本人のみ削除許可
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'photos' AND owner = auth.uid());
```

#### 確認方法

設定後、ダッシュボード → **Storage** → `photos` バケット → **Policies** タブで
3 つのポリシーが表示されていれば OK。

---

### Step 3: `photos` テーブルの RLS ポリシー設定

Storage（ファイル本体）とは別に、`photos` テーブル（メタデータ: URL, 座標, trip_id 等）にも
RLS ポリシーを設定する必要がある。
フロントの `supabase.from("photos").insert(...)` や `.select(...)` が成功するために必要。

#### 前提知識

- `photos` テーブルのカラム（`docs/database.md` 参照）:
  - `id`: int8, 主キー（自動採番）
  - `user_id`: uuid, 撮影者の ID（`auth.uid()` と一致する想定）
  - `trip_id`: uuid, 紐づく旅行の ID
  - `image_url`: text, Storage の public URL
  - `lat`, `lng`: float8, 撮影場所の座標
  - `created_at`, `updated_at`, `deleted_at`: timestamptz
- RLS が有効 & ポリシーなし → すべての操作が拒否される

#### RLS を有効にする（まだの場合）

ダッシュボード → **Table Editor** → `photos` テーブル → 右上の **RLS disabled** を
クリックして **Enable RLS** する。

または SQL:
```sql
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
```

#### 設定手順（ダッシュボード GUI）

1. ダッシュボード → 左メニュー **Authentication** → **Policies**
2. `photos` テーブルの行を見つけ、**New Policy** をクリック
3. 以下の 3 つのポリシーをそれぞれ作成する

#### ポリシー 1: INSERT（写真メタデータの保存）

ログイン済みユーザーが自分の `user_id` でレコードを追加できるようにする。
`auth.uid() = user_id` の条件で、他人になりすましたINSERTを防止する。

**GUI での設定:**
- **Policy name**: `Users can insert own photos`
- **Allowed operation**: INSERT
- **Target roles**: `authenticated`
- **WITH CHECK expression**:
```sql
auth.uid() = user_id
```

**SQL エディタで実行する場合:**
```sql
CREATE POLICY "Users can insert own photos"
ON public.photos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

**フロントコードとの対応:**
```typescript
// active.tsx の savePhoto 内
const { data: { user } } = await supabase.auth.getUser();
await supabase.from("photos").insert({
  trip_id: tripId,
  user_id: user.id,   // ← auth.uid() と一致する必要がある
  image_url: urlData.publicUrl,
  lat,
  lng,
});
```

#### ポリシー 2: SELECT（写真メタデータの取得）

同じ旅行のメンバーだけが写真を閲覧できるようにする。
`trip_members` テーブルを JOIN して、リクエストしたユーザーがその旅行のメンバーか確認する。

**GUI での設定:**
- **Policy name**: `Trip members can view photos`
- **Allowed operation**: SELECT
- **Target roles**: `authenticated`
- **USING expression**:
```sql
EXISTS (
  SELECT 1 FROM trip_members
  WHERE trip_members.trip_id = photos.trip_id
    AND trip_members.user_id = auth.uid()
    AND trip_members.deleted_at IS NULL
)
```

**SQL エディタで実行する場合:**
```sql
CREATE POLICY "Trip members can view photos"
ON public.photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_members.trip_id = photos.trip_id
      AND trip_members.user_id = auth.uid()
      AND trip_members.deleted_at IS NULL
  )
);
```

**フロントコードとの対応:**
```typescript
// active.tsx の fetchTripData 内
const photosResult = await supabase
  .from("photos")
  .select("*")
  .eq("trip_id", tripId)          // ← この trip_id のメンバーでなければ 0 件
  .is("deleted_at", null)
  .order("created_at", { ascending: true });
```

> **MVP で簡易にしたい場合の代替:**
> メンバー制限なしで、ログイン済みなら全写真を見られるようにする。
> ```sql
> CREATE POLICY "Authenticated users can view all photos"
> ON public.photos FOR SELECT
> TO authenticated
> USING (true);
> ```

#### ポリシー 3: UPDATE（論理削除用 / 任意）

撮影者本人だけが自分の写真レコードを更新（`deleted_at` の設定 = 論理削除）できるようにする。

**SQL エディタで実行する場合:**
```sql
CREATE POLICY "Users can update own photos"
ON public.photos FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

#### SQL エディタでまとめて実行する場合

```sql
-- RLS 有効化（既に有効なら不要）
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- INSERT: 本人の user_id でのみ追加可能
CREATE POLICY "Users can insert own photos"
ON public.photos FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- SELECT: 旅行メンバーのみ閲覧可能
CREATE POLICY "Trip members can view photos"
ON public.photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_members.trip_id = photos.trip_id
      AND trip_members.user_id = auth.uid()
      AND trip_members.deleted_at IS NULL
  )
);

-- UPDATE: 本人のみ更新可能（論理削除用）
CREATE POLICY "Users can update own photos"
ON public.photos FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

#### 確認方法

1. ダッシュボード → **Authentication** → **Policies** → `photos` テーブルにポリシーが表示される
2. ダッシュボード → **Table Editor** → `photos` テーブルで **RLS enabled** バッジが表示される
3. **SQL Editor** で以下を実行して設定済みポリシーを一覧確認:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'photos';
```

### Step 4: 認証機能の実装（前提条件）

現在 `savePhoto` 内で `supabase.auth.getUser()` を呼んでおり、未ログイン時は写真が保存されない。
認証機能の実装が**前提条件**となる。

**認証が未実装の間にテストする場合の暫定対策:**

`app/trip/active.tsx` の `savePhoto` 内でユーザー ID をハードコードする。

```typescript
// 暫定: 認証未実装の間のテスト用
const userId = "テスト用のUUID";  // Supabase の users テーブルに存在する ID
```

### Step 5: 動作確認

1. **実機で確認**（iOS シミュレータではカメラが使えない）
   - `npx expo start` → Expo Go で実機接続
   - 旅行開始中画面のカメラボタンをタップ
   - 撮影 → 保存完了を確認
2. **Supabase ダッシュボードで確認**
   - Storage → `photos` バケットにファイルが存在するか
   - Table Editor → `photos` テーブルにレコードが INSERT されているか
   - `image_url` の URL にブラウザからアクセスして画像が表示されるか

## 現状の結論

**フロントエンドのコードは完成している。**
実際にデータが保存されない原因は以下のいずれか（または複数）:

1. Supabase Storage に `photos` バケットが未作成
2. RLS ポリシーが未設定で INSERT が拒否されている
3. 認証（ログイン）が未実装で `supabase.auth.getUser()` が null を返している

→ **Step 1〜4 の Supabase 側セットアップを完了させれば動作する。**
