# 旅行開始中画面の実装

## 概要

「旅行を開始する」ボタン押下後に遷移する専用のフルスクリーン画面を新規作成する。
地図を全面表示し、カメラ撮影（位置情報付き）と旅行終了の機能を提供する。

## UIデザイン

`旅行開始中画面.png` を参照。

```
┌─────────────────────────────┐
│ ←                            │
│ ┌─────────────────────────┐ │
│ │ 広島旅行                 │ │  トリップ情報カード
│ │ 2026/2/26〜              │ │  （地図上にオーバーレイ）
│ │ ○○○○○○○○               │ │  参加者アバター
│ └─────────────────────────┘ │
│                             │
│         地図（全面表示）      │
│           📍 現在地          │
│                             │
│                             │
│   (終了)           (📷)     │  丸型フローティングボタン
└─────────────────────────────┘
   タブバーなし
```

**UIの要件:**
- 地図が画面全体の背景（タブバー非表示のフルスクリーン）
- 上部: 戻るボタン（←）+ トリップ情報カード（タイトル・開始日・参加者アバター）
- 下部: 大きな丸型ボタン2つ（終了 / カメラ）が地図上にフローティング
- 現在地をネイティブの青ドットで表示（`showsUserLocation`）

## タスク

### 環境構築

- [ ] `npx expo install expo-image-picker expo-location`
- [ ] `app.json` に plugins 追記（カメラ権限・位置情報権限メッセージ）

### ルーティング

- [ ] `app/_layout.tsx` に `trip/active` の Stack.Screen を追加（`headerShown: false`）
- [ ] `app/trip/[id].tsx` の `handleStart` を修正
  - `trips.status` を `"started"` に更新
  - 遷移先を `/(tabs)/map` → `/trip/active?tripId=xxx` に変更

### 画面作成（`app/trip/active.tsx` 新規）

- [ ] 地図の全面表示（`MapView` + `showsUserLocation` + `followsUserLocation`）
- [ ] 戻るボタン（`router.back()`）
- [ ] トリップ情報カード（タイトル・日付・参加者アバター）
  - Supabase から `trips` + `trip_members` → `users` を取得して表示
- [ ] 撮影済み写真の丸型ピン表示
  - Supabase から `photos` を取得し `Marker` で表示

### カメラ機能

- [ ] カメラ権限リクエスト（`ImagePicker.requestCameraPermissionsAsync`）
- [ ] 位置情報権限リクエスト（`Location.requestForegroundPermissionsAsync`）
- [ ] カメラ起動・撮影（`ImagePicker.launchCameraAsync`、`quality: 0.8`）
- [ ] 撮影時の緯度経度取得（`Location.getCurrentPositionAsync`、`Accuracy.High`）
- [ ] Supabase Storage へ画像アップロード
- [ ] `photos` テーブルへ INSERT（`trip_id`, `user_id`, `image_url`, `lat`, `lng`）
- [ ] 撮影後に地図上のピンを即時更新

### 終了ボタン

- [ ] 確認ダイアログ表示（`Alert.alert`）
- [ ] `trips.status` を `"finished"` に更新
- [ ] 前の画面に戻る（`router.back()`）

## 注意点

### パーミッション
- カメラ・位置情報権限は撮影ボタン押下時にリクエストする（初回のみダイアログ表示）
- 権限拒否時は `Alert` で案内して処理を中断する
- `showsUserLocation` が内部で位置情報権限を要求するため、カメラ撮影前に権限を取得しておけば二重ダイアログにならない

### `app.json` plugins

```json
{
  "expo": {
    "plugins": [
      ["expo-image-picker", { "cameraPermission": "旅行の写真を撮影するためにカメラを使用します" }],
      ["expo-location", { "locationWhenInUsePermission": "撮影場所を記録するために位置情報を使用します" }]
    ]
  }
}
```

Expo Go では不要だが EAS Build 時に必要。

### React Native での画像アップロード

`fetch(localUri).blob()` が動作しない場合がある。FormData を推奨:

```typescript
const formData = new FormData();
formData.append("file", {
  uri: imageUri,
  type: "image/jpeg",
  name: fileName,
} as any);
await supabase.storage.from("photos").upload(fileName, formData);
```

動かない場合は `expo-file-system` で base64 化する方法に切り替える。

### Supabase Storage
- Supabase ダッシュボードで `photos` バケットを事前作成（public 設定）
- RLS ポリシー: `authenticated` ユーザーのみ INSERT 可能にする
- ファイルパス: `{trip_id}/{timestamp}.jpg`

### シミュレータでのテスト
- **カメラ**: iOS シミュレータでは使えない → 実機で確認 or `launchImageLibraryAsync` で代替テスト
- **GPS**: Xcode → Features → Location → Custom Location でシミュレート

### 型の整合性
- `Trip.status` の値を `"planned" | "started" | "finished"` に統一する
- `map-screen.md` では `"active" / "completed"` を使用しているが、DB・モックに合わせる

## 対象ファイル

| ファイル | 変更 |
|---|---|
| `app/trip/active.tsx` | **新規**: 旅行開始中画面 |
| `app/trip/[id].tsx` | `handleStart` の遷移先・status 更新を変更 |
| `app/_layout.tsx` | Stack.Screen に `trip/active` を追加 |
| `app.json` | plugins に `expo-image-picker` / `expo-location` を追記 |
