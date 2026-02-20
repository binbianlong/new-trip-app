# マップ画面 実装ガイド

## 概要

マップ画面は **2 つのモード** を持つ。

| モード | 表示条件 | 機能 |
|---|---|---|
| **通常時** | `active` な旅行がない | 全旅行の経路・写真ピンを表示。写真の横スクロール閲覧 |
| **旅行開始中** | `active` な旅行がある | リアルタイム経路・カメラ撮影・旅行終了 |

地図は **Apple Maps**（`react-native-maps` デフォルト）を使用する。
API キー不要・Expo Go で動作するため、セットアップがシンプル。

---

## 前提条件

- Supabase クエリビルダーがセットアップ済み (`src/lib/supabase.ts`)
- DB に `trips`, `trip_participants`, `photos`, `route_points` テーブルが作成済み

---

## ファイル構成

```
app/(tabs)/map.tsx              ← マップ画面本体
src/types/index.ts              ← 型定義
src/lib/supabase.ts             ← Supabase クライアント（作成済み）
```

---

## フェーズ A: 通常時のマップ（map コンポーネント作成）

### A-1. パッケージのインストール

```bash
npm install react-native-maps
```

> Apple Maps を使うため、API キーの設定や `app.json` の変更は不要。
> Expo Go でそのまま動作する。

### A-2. 型定義の作成

`src/types/index.ts` に以下の型を定義する。
DB のカラム名に合わせてスネークケースにする。

```typescript
export type TripStatus = "planned" | "active" | "completed";

export interface Trip {
  id: string;
  title: string;
  start_date: string;
  memo: string | null;
  status: TripStatus;
  owner_id: string;
  invite_code: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Photo {
  id: string;
  trip_id: string;
  user_id: string;
  image_url: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  caption: string | null;
  taken_at: string;
  created_at: string;
}

export interface RoutePoint {
  id: string;
  trip_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}
```

### A-3. 地図の基本表示

`app/(tabs)/map.tsx` を以下の構成にする:

```typescript
import MapView, { Marker, Polyline } from "react-native-maps";

<MapView
  style={{ flex: 1 }}
  initialRegion={{
    latitude: 36.5,     // 日本の中心付近
    longitude: 137.0,
    latitudeDelta: 14,  // 日本全体が収まるズーム
    longitudeDelta: 14,
  }}
/>
```

**確認ポイント**: Expo Go で地図が表示されることを確認する。

### A-4. Supabase から写真データを取得

**重要: 自分が参加している旅行（フレンドとして参加含む）の写真を全て取得する。**

```typescript
import { supabase } from "@/src/lib/supabase";

// ① 自分が参加している旅行IDを全て取得
const { data: participations } = await supabase
  .from("trip_participants")
  .select("trip_id")
  .eq("user_id", currentUserId);

const tripIds = participations?.map(p => p.trip_id) ?? [];

// ② それらの旅行の写真を取得
const { data: photos } = await supabase
  .from("photos")
  .select("*")
  .in("trip_id", tripIds);

// ③ 経路ポイントを取得
const { data: routePoints } = await supabase
  .from("route_points")
  .select("*")
  .in("trip_id", tripIds)
  .order("recorded_at", { ascending: true });
```

### A-5. 写真ピンの表示

地図上にピン📍型のマーカーで表示する。

```typescript
{photos.map(photo => (
  <Marker
    key={photo.id}
    coordinate={{
      latitude: photo.latitude,
      longitude: photo.longitude,
    }}
    title={photo.location_name ?? "撮影地点"}
  />
))}
```

### A-6. 経路の表示

旅行ごとに `Polyline` で経路線を描画する。

```typescript
// trip_id ごとにグループ化
const routesByTrip = groupBy(routePoints, "trip_id");

{Object.entries(routesByTrip).map(([tripId, points]) => (
  <Polyline
    key={tripId}
    coordinates={points.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }))}
    strokeColor="#4A90D9"
    strokeWidth={3}
  />
))}
```

### A-7. 下部の写真スクロール + 地図同期

経路（旅行ピン）をタップしたら、画面下部に写真を横スクロールで表示する。
スクロール中央の写真と地図上のピンを同期させる。

```
┌───────────────────────┐
│                       │
│        地図            │
│    📍   📍   📍       │
│     ╲  ╱              │
│      📍               │
│                       │
├───────────────────────┤
│  旅行名  日付         │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
│ │写│ │写│ │写│ │写│  │  ← 横スクロール
│ │真│ │真│ │真│ │真│  │
│ └──┘ └──┘ └──┘ └──┘  │
├───────────────────────┤
│  🏠 ホーム   🗺 マップ │
└───────────────────────┘
```

**同期の仕組み:**

```typescript
// FlatList の onViewableItemsChanged で中央の写真を検知
const onViewableItemsChanged = useCallback(({ viewableItems }) => {
  if (viewableItems.length > 0) {
    const centerPhoto = viewableItems[Math.floor(viewableItems.length / 2)].item;
    // 地図を該当写真の位置に移動
    mapRef.current?.animateToRegion({
      latitude: centerPhoto.latitude,
      longitude: centerPhoto.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 300);
  }
});
```

---

## フェーズ B: 旅行開始中モード

### B-1. モード切り替え

`status === "active"` の旅行があるかで UI を切り替える。

```typescript
const { data: activeTrip } = await supabase
  .from("trips")
  .select("*")
  .eq("owner_id", currentUserId)
  .eq("status", "active")
  .maybeSingle();

const isTripActive = activeTrip != null;
```

```
isTripActive === true  → 旅行中UI（カメラボタン + 終了ボタン）
isTripActive === false → 通常UI（写真閲覧モード）
```

### B-2. カメラ機能

**必要パッケージ:**

```bash
npm install expo-image-picker expo-location
```

**撮影フロー:**

```
カメラボタンタップ
  → カメラ権限チェック (ImagePicker.requestCameraPermissionsAsync)
  → 位置情報権限チェック (Location.requestForegroundPermissionsAsync)
  → カメラ起動 (ImagePicker.launchCameraAsync)
  → 撮影
  → 現在位置を取得 (Location.getCurrentPositionAsync)
  → 逆ジオコーディングで地名取得 (Location.reverseGeocodeAsync) ※任意
  → Supabase Storage に画像アップロード
  → photos テーブルに INSERT
  → 地図にピン追加
```

**コード例:**

```typescript
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

async function takePhoto(tripId: string, userId: string) {
  // 権限チェック
  const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
  if (!cameraPermission.granted) return;

  const locationPermission = await Location.requestForegroundPermissionsAsync();
  if (!locationPermission.granted) return;

  // 撮影
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
  });
  if (result.canceled) return;

  const imageUri = result.assets[0].uri;

  // 現在位置を取得
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  const { latitude, longitude } = location.coords;

  // ここから B-3 のデータ保存へ
}
```

### B-3. データ保存（Supabase）

```typescript
// ① 画像を Supabase Storage にアップロード
const fileName = `${tripId}/${Date.now()}.jpg`;
const { data: uploadData, error: uploadError } = await supabase.storage
  .from("photos")
  .upload(fileName, {
    uri: imageUri,
    type: "image/jpeg",
    name: fileName,
  });

// ② 公開URLを取得
const { data: urlData } = supabase.storage
  .from("photos")
  .getPublicUrl(fileName);

// ③ photos テーブルに INSERT
const { error } = await supabase.from("photos").insert({
  trip_id: tripId,
  user_id: userId,
  image_url: urlData.publicUrl,
  latitude: latitude,
  longitude: longitude,
  taken_at: new Date().toISOString(),
});
```

### B-4. 終了ボタン

```typescript
async function endTrip(tripId: string) {
  // 確認ダイアログ
  Alert.alert("旅行終了", "旅行を終了しますか？", [
    { text: "キャンセル", style: "cancel" },
    {
      text: "終了する",
      style: "destructive",
      onPress: async () => {
        await supabase
          .from("trips")
          .update({ status: "completed" })
          .eq("id", tripId);
        // → 通常モードに切り替わる
      },
    },
  ]);
}
```

---

## 注意点

### Apple Maps について

| 項目 | 内容 |
|---|---|
| API キー | **不要** |
| Expo Go | **動作する** |
| 対応 OS | **iOS のみ**。Android は非対応 |
| 費用 | **無料** |

> Android 対応が必要になった場合は、Android のみ Google Maps に切り替える。
> `provider` を条件分岐させれば共存可能。

### 位置情報 (expo-location)

| 注意点 | 対応 |
|---|---|
| パーミッション必須 | 撮影前に `requestForegroundPermissionsAsync` を呼ぶ |
| シミュレータで GPS が取れない | Xcode → Features → Location でシミュレート |
| 精度のバラつき | `accuracy: Location.Accuracy.High` を指定 |

### カメラ (expo-image-picker)

| 注意点 | 対応 |
|---|---|
| カメラ権限必須 | `requestCameraPermissionsAsync` を事前に呼ぶ |
| 撮影結果はローカルパス | Supabase Storage にアップロードして URL に変換する |
| 画像サイズ | `quality: 0.8` で圧縮。ストレージ節約のため |

### Supabase データ取得

| 注意点 | 対応 |
|---|---|
| フレンドの旅行も取得 | `trip_participants` で自分の `user_id` を検索 → 全参加旅行の写真を取得 |
| RLS ポリシー | 参加者のみ SELECT 可能にする |
| データ量が増えた場合 | `.limit()` や日付フィルタで絞る |

### パフォーマンス

| 注意点 | 対応 |
|---|---|
| ピンが多い | マーカークラスタリングの導入を検討 |
| 経路ポイントが多い | 座標を間引き (simplify) して Polyline に渡す |
| 画像の読み込み | サムネイルを別途用意、または Supabase Storage の transform で縮小 |

---

## 実装順序

```
① パッケージインストール (react-native-maps)
② 地図の基本表示 → Expo Go で確認
③ 型定義の作成
④ Supabase から写真・経路データ取得
⑤ 写真ピンを地図上に表示
⑥ 経路線を表示
⑦ 下部写真スクロール + 地図同期
── ここまでが通常時 ──
⑧ パッケージ追加 (expo-image-picker, expo-location)
⑨ 旅行中モードの UI 切り替え
⑩ カメラ撮影 + GPS 取得
⑪ Supabase Storage アップロード + photos INSERT
⑫ 終了ボタン (status UPDATE)
```
