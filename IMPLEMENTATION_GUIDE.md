# 旅シェア - 画面ごとの実装計画

---

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | React Native (Expo SDK 54) |
| ナビゲーション | Expo Router (ファイルベースルーティング) |
| 言語 | TypeScript |
| バックエンド | Supabase (認証・DB・ストレージ) |
| 地図 | react-native-maps |
| リンター | Biome |
| Git Hooks | Husky + lint-staged |

---

## 画面一覧と遷移図

```
[サインアップ] → [ユーザー情報入力] → [ホーム]
                                        │
                     ┌──────────────┬────┴────┐
                     ▼              ▼         ▼
              [旅行プラン作成]  [旅行詳細]  [マップ]
                                   │         │
                                   ▼         ▼
                              [マップ(旅行中)]
```

### ファイル構成

```
app/
├── _layout.tsx              # ルートレイアウト (Stack)
├── (tabs)/
│   ├── _layout.tsx          # タブレイアウト (ホーム / マップ)
│   ├── index.tsx            # ホーム画面
│   └── map.tsx              # マップ画面
├── login.tsx                # サインアップ画面
├── onboarding.tsx           # ユーザー情報入力画面 [新規]
├── create.tsx               # 旅行プラン作成画面
└── trip/
    └── [id].tsx             # 旅行プラン詳細画面
src/
├── constants/colors.ts      # カラーパレット
├── types/index.ts           # 型定義
├── data/mock.ts             # モックデータ
├── components/
│   └── ParticipantModal.tsx # 参加者追加モーダル [新規]
├── lib/supabase.ts          # Supabase クライアント
└── hooks/useAuth.ts         # 認証 Hook
```

---

## Step 0: 環境構築

> **ゴール**: `npx expo start` でアプリが起動できる状態

### やること

1. nvm で `node v20.20.0` / `npm v10.8.2` をインストール
2. `npm install` で依存パッケージをインストール
3. `.env.example` → `.env` を作成（Supabase URL / Anon Key）
4. Biome 拡張を入れ `npm run lint` / `npm run typecheck` が通ることを確認
5. `npx expo start` でアプリが起動することを確認

---

## Step 1: プロジェクト基盤

> **ゴール**: ルーティング・画面遷移が動作し、共通の型・定数が揃っている状態

### やること

1. **Expo Router セットアップ**
   - `package.json` → `"main": "expo-router/entry"`
   - `app.json` → `expo-router` プラグイン + `scheme` 追加
   - `tsconfig.json` → `baseUrl`, `paths` エイリアス設定

2. **ルートレイアウト** (`app/_layout.tsx`)
   - `<Stack>` で全画面のナビゲーションを定義
   - 登録する画面: `(tabs)`, `login`, `onboarding`, `create`, `trip/[id]`

3. **タブレイアウト** (`app/(tabs)/_layout.tsx`)
   - 「ホーム」「マップ」の 2 タブ構成
   - Ionicons でタブアイコン設定

4. **共通定数**
   - `src/constants/colors.ts` — カラーパレット
   - `src/types/index.ts` — 全型定義

5. **型定義一覧**
   ```typescript
   // ユーザー
   interface User {
     id: string;
     username: string;       // ユーザーID（一意）
     displayName: string;    // ユーザーネーム
     avatarUri?: string;     // アイコン画像URL
     tripsCount: number;
     photosCount: number;
   }

   // 旅行プロジェクト
   type TripStatus = "planned" | "active" | "completed";
   interface TripProject {
     id: string;
     title: string;
     startDate: string;
     memo?: string;
     status: TripStatus;
     participants: Participant[];
     inviteLink?: string;
     createdAt: string;
     ownerId: string;
     latitude?: number;     // 代表地点
     longitude?: number;
   }

   // 参加者
   interface Participant {
     id: string;
     displayName: string;
     avatarColor: string;
   }

   // 写真
   interface TripPhoto {
     id: string;
     tripId: string;
     uri: string;
     latitude: number;
     longitude: number;
     takenAt: string;
     takenBy: string;
     locationName?: string;
     caption?: string;
   }

   // 経路ポイント
   interface RoutePoint {
     latitude: number;
     longitude: number;
     timestamp: string;
   }
   ```

6. **全画面にプレースホルダーを配置**し、遷移の動作確認

### 確認項目
- [ ] タブ切り替えが動く
- [ ] 各スタック画面に遷移できる
- [ ] `npm run typecheck` が通る

---

## Step 2: サインアップ画面

> **ゴール**: Google アカウントでサインアップ/ログインできる状態

### ファイル: `app/login.tsx`

### UI 要素

| 要素 | 説明 |
|------|------|
| アプリロゴ | アイコン + アプリ名「旅シェア」 |
| タグライン | 「旅の思い出をみんなで共有しよう」 |
| **Google 認証ボタン** | Google ロゴ +「Google でサインアップ」 |
| 利用規約テキスト | フッター付近に小さく表示 |

### ワイヤーフレーム

```
┌───────────────────────┐
│                       │
│       ✈ (ロゴ)        │
│       旅シェア         │
│  旅の思い出をみんなで   │
│     共有しよう          │
│                       │
│  ┌─────────────────┐  │
│  │ G  Googleで      │  │
│  │    サインアップ    │  │
│  └─────────────────┘  │
│                       │
│  利用規約に同意...      │
└───────────────────────┘
```

### 実装詳細

1. **モック実装（初期）**
   - ボタンタップ → `Alert` で成功表示 → ユーザー情報入力画面 (`/onboarding`) に遷移
   - 既存ユーザーの場合はホーム画面に遷移

2. **本実装（Supabase 連携後）**
   - `expo-auth-session` + `expo-web-browser` で Google OAuth
   - Supabase の `signInWithOAuth` を呼び出し
   - セッション永続化: `@react-native-async-storage/async-storage`

3. **認証ガード** (`app/_layout.tsx`)
   - 未ログイン → `/login` にリダイレクト
   - ログイン済み & プロフィール未設定 → `/onboarding` にリダイレクト
   - ログイン済み & プロフィール設定済み → `/(tabs)` に遷移

### 画面遷移
```
[サインアップ] → (新規ユーザー) → [ユーザー情報入力]
             → (既存ユーザー) → [ホーム]
```

---

## Step 3: ユーザー情報入力画面

> **ゴール**: 初回サインアップ後にプロフィール情報を設定できる状態

### ファイル: `app/onboarding.tsx` [新規作成]

### UI 要素

| 要素 | 説明 |
|------|------|
| **アイコン入力** | 丸型エリア。タップでカメラロールから選択 |
| **ユーザーネーム入力欄** | 表示名（例: 旅太郎） |
| **ユーザーID 入力欄** | 一意の ID（例: tabi_taro）。他ユーザーが検索に使う |
| **完了ボタン** | プロフィール保存 → ホーム画面に遷移 |

### ワイヤーフレーム

```
┌───────────────────────┐
│   プロフィール設定      │
│                       │
│       ┌────┐          │
│       │ 📷 │  ← タップで画像選択
│       └────┘          │
│   アイコンを設定        │
│                       │
│  ユーザーネーム         │
│  ┌─────────────────┐  │
│  │ 旅太郎           │  │
│  └─────────────────┘  │
│                       │
│  ユーザーID            │
│  ┌─────────────────┐  │
│  │ @tabi_taro       │  │
│  └─────────────────┘  │
│  ※後から変更できません   │
│                       │
│  ┌─────────────────┐  │
│  │    はじめる       │  │
│  └─────────────────┘  │
└───────────────────────┘
```

### 実装詳細

1. **アイコン選択**
   - `expo-image-picker` の `launchImageLibraryAsync` でカメラロールから選択
   - 選択後にプレビュー表示（丸型クリッピング）
   - 未設定時はデフォルトアイコン（イニシャル or プレースホルダー）

2. **バリデーション**
   - ユーザーネーム: 必須、1〜20 文字
   - ユーザーID: 必須、英数字 + アンダースコアのみ、3〜20 文字
   - ユーザーID の重複チェック（Supabase 連携後）

3. **保存処理**
   - モック: ローカル state に保存 → ホームに遷移
   - 本実装: Supabase `profiles` テーブルに INSERT + Storage にアバター画像アップロード

### 画面遷移
```
[ユーザー情報入力] → [ホーム]  (完了ボタン)
```

---

## Step 4: ホーム画面

> **ゴール**: 旅行プラン一覧が表示され、作成・詳細への遷移ができる状態

### ファイル: `app/(tabs)/index.tsx`

### UI 要素

| 要素 | 説明 |
|------|------|
| ヘッダー | アプリ名「旅シェア」 |
| **旅行プランカード一覧** | `FlatList` で縦スクロール |
| 旅行プランカード | タイトル + 開始日 |
| **旅行プラン作成ボタン** | FAB (右下) or リスト上部ボタン |
| **フッター (タブ)** | ホーム / マップ |

### ワイヤーフレーム

```
┌───────────────────────┐
│  旅シェア              │
├───────────────────────┤
│                       │
│  ┌─────────────────┐  │
│  │ 京都日帰り旅行    │  │
│  │ 2026/2/15        │  │
│  └─────────────────┘  │
│                       │
│  ┌─────────────────┐  │
│  │ 箱根温泉旅行     │  │
│  │ 2026/1/25        │  │
│  └─────────────────┘  │
│                       │
│  ┌─────────────────┐  │
│  │ 北海道スキー旅行  │  │
│  │ 2025/12/28       │  │
│  └─────────────────┘  │
│                   (+) │ ← 作成ボタン
├───────────────────────┤
│  🏠 ホーム   🗺 マップ │
└───────────────────────┘
```

### 実装詳細

1. **旅行プランカード**
   - シンプルに **タイトル** と **開始日** のみ表示
   - タップで旅行プラン詳細画面 (`/trip/[id]`) に遷移
   - ステータスによる並び順: active → planned → completed

2. **旅行プラン作成ボタン**
   - FAB (FloatingActionButton): 右下に `+` アイコン
   - タップで旅行プラン作成画面 (`/create`) に遷移

3. **空状態**
   - プランがない場合:「旅行プランがありません。新しい旅行を作成しましょう！」

### 画面遷移
```
[ホーム] → /trip/[id]   (カードタップ)
[ホーム] → /create      (作成ボタン)
[ホーム] ↔ /map         (タブ切り替え)
```

---

## Step 5: 旅行プラン作成画面

> **ゴール**: フォーム入力 + 参加者モーダルで旅行プランを作成できる状態

### ファイル: `app/create.tsx` + `src/components/ParticipantModal.tsx` [新規]

### UI 要素

| 要素 | 説明 |
|------|------|
| **タイトル入力欄** | 必須。プレースホルダー:「例: 京都日帰り旅行」 |
| **参加者追加ボタン** | タップで参加者モーダルを開く |
| 追加済み参加者チップ | アイコン + 名前のチップ表示 |
| **参加者モーダル** | 後述 |
| **開始日入力** | 日付入力。将来的に DatePicker |
| **メモ欄** | 任意。複数行テキスト |
| **作成完了ボタン** | バリデーション → 保存 → ホームに戻る |

### 参加者モーダル詳細

参加者追加ボタンをタップすると `<Modal>` が表示される:

```
┌───────────────────────┐
│   参加者を追加     ✕   │
├───────────────────────┤
│  🔍 ユーザーIDで検索   │
│  ┌─────────────────┐  │
│  │ @tabi_taro       │  │
│  └─────────────────┘  │
│                       │
│  ── 検索結果 ──        │
│  ┌─────────────────┐  │
│  │ 🟢 鉄子          │  │ ← タップで選択
│  │    @tetsu_ko      │  │
│  └─────────────────┘  │
│  ┌─────────────────┐  │
│  │ 🟠 花子          │  │
│  │    @hanako        │  │
│  └─────────────────┘  │
│                       │
│  ── 追加済み ──        │
│  🟢鉄子  🟠花子        │
│                       │
│  ┌─────────────────┐  │
│  │     追加する      │  │
│  └─────────────────┘  │
└───────────────────────┘
```

| モーダル要素 | 説明 |
|---|---|
| **ID 検索窓** | テキスト入力。入力に応じて検索結果をフィルタ |
| **検索結果表示** | ユーザーアイコン + ユーザー名の一覧。タップで選択トグル |
| **追加したユーザー表示エリア** | 選択済みユーザーのアイコン + 名前をチップ表示 |
| **追加ボタン** | モーダルを閉じ、選択した参加者をフォームに反映 |

### ワイヤーフレーム（作成画面全体）

```
┌───────────────────────┐
│  ← 旅行プラン作成       │
├───────────────────────┤
│                       │
│  タイトル *             │
│  ┌─────────────────┐  │
│  │                 │  │
│  └─────────────────┘  │
│                       │
│  参加者                │
│  ┌─────────────────┐  │
│  │ + 参加者を追加    │  │ ← タップでモーダル
│  └─────────────────┘  │
│  🟢鉄子  🟠花子        │ ← 追加済みチップ
│                       │
│  開始日 *              │
│  ┌─────────────────┐  │
│  │ 2026/03/20      │  │
│  └─────────────────┘  │
│                       │
│  メモ                  │
│  ┌─────────────────┐  │
│  │                 │  │
│  │                 │  │
│  └─────────────────┘  │
│                       │
│  ┌─────────────────┐  │
│  │  ✈ 作成する      │  │
│  └─────────────────┘  │
└───────────────────────┘
```

### 実装詳細

1. **`ParticipantModal` コンポーネント** (`src/components/ParticipantModal.tsx`)
   - Props: `visible`, `onClose`, `onConfirm(participants[])`, `currentParticipants[]`
   - 内部 state: `query` (検索文字列), `searchResults[]`, `selectedUsers[]`
   - 検索はモック段階ではローカルフィルタ、Supabase 連携後は DB 検索

2. **バリデーション**
   - タイトル: 必須
   - 開始日: 必須
   - 参加者: 任意（0 人でも作成可）

3. **作成完了後の処理**
   - モック: `Alert` で成功通知 → ホーム画面に戻る
   - 本実装: Supabase に INSERT → 招待リンク生成 → Share API で共有

### 画面遷移
```
[旅行プラン作成] → [ホーム]  (作成完了)
[旅行プラン作成] → (戻る)    (← ボタン)
```

---

## Step 6: 旅行プラン詳細画面

> **ゴール**: 旅行の詳細情報が見られ、旅行開始ボタンで旅行を開始できる状態

### ファイル: `app/trip/[id].tsx`

### UI 要素

| 要素 | 説明 |
|------|------|
| **タイトル** | 旅行名（大きめフォント） |
| **参加者** | アバター + 名前一覧 |
| **開始日** | カレンダーアイコン + 日付 |
| **メモ** | メモ内容（ある場合のみ） |
| **旅行開始ボタン** | ステータスが `planned` の時に表示 |

### ワイヤーフレーム

```
┌───────────────────────┐
│  ← 旅行詳細            │
├───────────────────────┤
│                       │
│  京都日帰り旅行         │
│                       │
│  参加者                │
│  🟢旅  🔵鉄            │
│  旅太郎  鉄子           │
│                       │
│  📅 2026/2/15          │
│                       │
│  📝 伏見稲荷と          │
│     清水寺を回る予定     │
│                       │
│                       │
│                       │
│  ┌─────────────────┐  │
│  │ ▶ 旅行を開始する  │  │
│  └─────────────────┘  │
└───────────────────────┘
```

### ステータスごとの表示

| ステータス | 表示内容 |
|---|---|
| `planned` | 旅行情報 +「**旅行を開始する**」ボタン |
| `active` | 旅行情報 + ステータスバッジ「旅行中」（操作はマップ画面で行う） |
| `completed` | 旅行情報 + ステータスバッジ「完了」 |

### 実装詳細

1. **動的ルーティング**
   - `useLocalSearchParams<{ id: string }>()` で旅行 ID を取得
   - 対応する旅行がない場合は「見つかりません」表示

2. **旅行開始ボタン**
   - 確認ダイアログ →「開始する」で status を `active` に変更
   - 開始と同時にマップ画面に切り替え（旅行中モードに遷移）
   - 本実装: Supabase で status を UPDATE + 位置情報記録開始

3. **レイアウト**
   - `ScrollView` でコンテンツ全体をラップ
   - シンプルな情報表示に集中（地図プレビューは不要）

### 画面遷移
```
[旅行詳細] → [マップ(旅行中)]  (旅行開始ボタン)
[旅行詳細] → (戻る)            (← ボタン)
```

---

## Step 7: マップ画面 — 通常時

> **ゴール**: 日本全体の旅行経路と写真ピンが表示され、経路タップで写真ギャラリーが見られる状態

### ファイル: `app/(tabs)/map.tsx`

### UI 要素（通常時）

| 要素 | 説明 |
|------|------|
| **地図** | 日本全体を表示。旅行ごとのピン + 経路線 |
| **経路** | 旅行ピンを時系列順に破線で接続 |
| **写真ピン** | 地図上に📍型のピンで表示 |
| **写真表示エリア** | 経路タップで画面下部に横スクロール写真ギャラリー |

### ワイヤーフレーム（通常時・経路タップ後）

```
┌───────────────────────┐
│                       │
│    [北海道] ●          │
│        ╲              │
│         ╲             │
│    [京都]●──●[箱根]    │ ← 旅行ピン + 経路線
│           📍📍         │ ← 写真ピン
│       📍              │
│                       │
├───────────────────────┤
│  京都日帰り旅行         │
│  2026/2/15         >  │ ← タップで詳細へ
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
│ │写│ │写│ │写│ │写│  │ ← 横スクロール
│ │真│ │真│ │真│ │真│  │   中央の写真と
│ └──┘ └──┘ └──┘ └──┘  │   地図ピンが同期
│  コメント表示エリア      │
├───────────────────────┤
│  🏠 ホーム   🗺 マップ │
└───────────────────────┘
```

### 実装詳細

1. **旅行ピン**
   - 各旅行を 1 つのカスタムマーカー（旅行名ラベル付き）として表示
   - 旅行ごとに色分け
   - タップで下部パネルにその旅行の写真ギャラリーを表示

2. **旅行間の経路線**
   - 旅行を `startDate` 順にソート
   - `Polyline` で各旅行ピンを破線で接続

3. **写真ピン**
   - 📍型ピンとして地図上に表示（選択中の旅行の写真のみ）
   - タップで下部ギャラリーの該当写真にスクロール

4. **写真ギャラリー（画面下部）**
   - `FlatList` (horizontal) で横スクロール
   - **地図と同期**: スクロール中央に来ている写真に対応する地図上のピンにフォーカス
   - `onViewableItemsChanged` で中央の写真を検知 → `mapRef.animateToRegion` で地図を移動
   - 写真カードにはコメント（キャプション）を表示

5. **未選択状態**
   - 「旅行の経路をタップして写真を見よう」ガイドメッセージ

### 技術ポイント: 写真スクロールと地図の同期

```typescript
// FlatList の onViewableItemsChanged で中央の写真を検知
const onViewableItemsChanged = useCallback(({ viewableItems }) => {
  const centerItem = viewableItems[Math.floor(viewableItems.length / 2)];
  if (centerItem) {
    // 地図を該当写真の位置に移動
    mapRef.current?.animateToRegion({
      latitude: centerItem.item.latitude,
      longitude: centerItem.item.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setFocusedPhotoId(centerItem.item.id);
  }
});
```

### 画面遷移
```
[マップ] → /trip/[id]   (ヘッダーの旅行名タップ)
[マップ] ↔ /home         (タブ切り替え)
```

---

## Step 8: マップ画面 — 旅行開始中

> **ゴール**: 旅行中にリアルタイム経路表示、写真撮影、旅行終了ができる状態

### ファイル: `app/(tabs)/map.tsx`（通常時と同じファイル、モード切り替え）

### UI 要素（旅行開始中）

| 要素 | 説明 |
|------|------|
| **経路** | リアルタイムの移動経路を線で表示 |
| **写真** | 撮影した写真が地図上にピン表示 |
| **旅行終了ボタン** | 画面上部 or フローティング |
| **カメラボタン** | 画面下部中央にフローティング |

### ワイヤーフレーム（旅行中）

```
┌───────────────────────┐
│  京都日帰り旅行  [終了] │ ← 旅行名 + 終了ボタン
│                       │
│            📍          │
│           ╱           │
│      📍──╱            │
│     ╱                 │
│  📍╱                  │ ← リアルタイム経路
│  ●                    │ ← 現在地
│                       │
│                       │
│                       │
│                       │
│         📷            │ ← カメラボタン (FAB)
├───────────────────────┤
│  🏠 ホーム   🗺 マップ │
└───────────────────────┘
```

### 実装詳細

1. **旅行中モードの判定**
   ```typescript
   const activeTrip = mockTrips.find(t => t.status === "active");
   const isTripActive = activeTrip != null;
   // isTripActive で通常時/旅行中のUIを切り替え
   ```

2. **経路のリアルタイム記録**
   - `expo-location` の `watchPositionAsync` で位置情報を定期取得
   - 取得した座標を `routePoints` state に追加
   - `Polyline` で実線として描画

3. **カメラボタン**
   - FAB スタイルで画面下部中央に配置
   - タップで `expo-image-picker` の `launchCameraAsync` を呼び出し
   - 撮影後: 現在の位置情報を取得 → `TripPhoto` オブジェクト生成 → 地図にピン追加
   - `expo-location` の `reverseGeocodeAsync` で地名を自動取得

4. **旅行終了ボタン**
   - 確認ダイアログ →「終了する」で status を `completed` に変更
   - 経路記録を停止
   - 通常モードに戻り、完了した旅行として表示

5. **写真撮影フロー**
   ```
   カメラボタン → カメラ起動 → 撮影
   → GPS座標取得 → 逆ジオコーディング(地名取得)
   → TripPhoto生成 → state追加 → 地図にピン追加
   ```

### パーミッション設定 (`app.json`)

```json
{
  "plugins": [
    [
      "expo-image-picker",
      { "cameraPermission": "写真を撮影するためにカメラを使用します" }
    ],
    [
      "expo-location",
      {
        "locationWhenInUsePermission": "旅行中の位置情報を記録します",
        "locationAlwaysPermission": "バックグラウンドでも経路を記録します"
      }
    ]
  ]
}
```

### 画面遷移
```
[マップ(旅行中)] → (旅行終了) → [マップ(通常)]
```

---

## Step 9: バックエンド連携 (Supabase)

> **ゴール**: モックデータを廃止し、全データを Supabase で管理する状態

### やること

1. **Supabase プロジェクトの作成・テーブル設計**

   ```sql
   -- ユーザープロフィール
   CREATE TABLE profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id),
     username TEXT UNIQUE NOT NULL,
     display_name TEXT NOT NULL,
     avatar_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- 旅行プロジェクト
   CREATE TABLE trips (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     title TEXT NOT NULL,
     start_date DATE NOT NULL,
     memo TEXT,
     status TEXT CHECK (status IN ('planned','active','completed')) DEFAULT 'planned',
     owner_id UUID REFERENCES profiles(id) NOT NULL,
     invite_code TEXT UNIQUE,
     latitude DOUBLE PRECISION,
     longitude DOUBLE PRECISION,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- 旅行参加者
   CREATE TABLE trip_participants (
     trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
     user_id UUID REFERENCES profiles(id),
     PRIMARY KEY (trip_id, user_id)
   );

   -- 写真
   CREATE TABLE photos (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
     user_id UUID REFERENCES profiles(id),
     image_url TEXT NOT NULL,
     latitude DOUBLE PRECISION NOT NULL,
     longitude DOUBLE PRECISION NOT NULL,
     location_name TEXT,
     caption TEXT,
     taken_at TIMESTAMPTZ NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- 経路ポイント
   CREATE TABLE route_points (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
     latitude DOUBLE PRECISION NOT NULL,
     longitude DOUBLE PRECISION NOT NULL,
     recorded_at TIMESTAMPTZ NOT NULL
   );
   ```

2. **RLS (Row Level Security)**
   - 自分が参加している旅行のみ閲覧・編集可能
   - 写真・経路は旅行参加者のみアクセス可能

3. **API レイヤーの実装**
   ```
   src/lib/supabase.ts     — クライアント初期化
   src/api/auth.ts         — サインアップ / ログイン / ログアウト
   src/api/trips.ts        — 旅行の CRUD + ステータス更新
   src/api/photos.ts       — 写真のアップロード / 取得
   src/api/users.ts        — ユーザー検索（参加者モーダル用）
   ```

4. **Supabase Storage**
   - `avatars` バケット: ユーザーアイコン画像
   - `photos` バケット: 旅行写真 (`{trip_id}/{photo_id}.jpg`)

5. **各画面のモック → Supabase 置き換え**

   | 画面 | 変更内容 |
   |---|---|
   | サインアップ | モック → `supabase.auth.signInWithOAuth` |
   | ユーザー情報入力 | ローカル → `profiles` テーブルに INSERT |
   | ホーム | `mockTrips` → `supabase.from('trips').select()` |
   | 旅行作成 | `Alert` → `supabase.from('trips').insert()` |
   | 旅行詳細 | `mockTrips.find` → `supabase.from('trips').select().eq('id', id)` |
   | マップ | `mockPhotos` → `supabase.from('photos').select()` |
   | 参加者モーダル | ローカルフィルタ → `supabase.from('profiles').select().ilike('username', query)` |

---

## Step 10: 仕上げ・テスト・リリース

> **ゴール**: プロダクション品質で配布できる状態

### やること

1. **エラーハンドリング**
   - ネットワークエラーの再試行 UI
   - ローディングスピナー / スケルトン表示
   - 入力バリデーションのインラインエラー表示

2. **パフォーマンス最適化**
   - 画像キャッシュ (`expo-image`)
   - 写真が多い場合のマーカークラスタリング
   - `useMemo` / `useCallback` の適切な使用

3. **UI / UX の磨き込み**
   - 画面遷移アニメーション
   - タップフィードバック
   - 空状態・エラー状態のイラスト

4. **テスト**
   - コンポーネント単体テスト (Jest + RNTL)
   - API レイヤーのテスト
   - E2E テスト (Maestro)

5. **リリース準備**
   - `eas build` でビルド設定
   - アプリアイコン・スプラッシュスクリーン
   - App Store / Google Play ストア情報
   - `eas submit` で提出

---

## まとめ

| Step | 画面 / テーマ | 主な成果物 |
|------|-------------|-----------|
| 0 | 環境構築 | Node.js, Expo, .env が動作 |
| 1 | プロジェクト基盤 | ルーティング, 型定義, カラー, プレースホルダー画面 |
| 2 | サインアップ画面 | Google 認証ボタン, 認証ガード |
| 3 | ユーザー情報入力画面 | アイコン選択, ユーザーネーム/ID 入力, プロフィール保存 |
| 4 | ホーム画面 | 旅行カード一覧 (タイトル+開始日), 作成ボタン |
| 5 | 旅行プラン作成画面 | 入力フォーム, 参加者モーダル (ID検索), 作成完了 |
| 6 | 旅行プラン詳細画面 | 旅行情報表示, 旅行開始ボタン |
| 7 | マップ画面 (通常時) | 旅行ピン, 経路線, 写真ピン, 横スクロール写真ギャラリー (地図同期) |
| 8 | マップ画面 (旅行中) | リアルタイム経路, カメラ撮影, 旅行終了 |
| 9 | バックエンド連携 | Supabase DB/Auth/Storage, モック廃止 |
| 10 | 仕上げ・リリース | エラー処理, テスト, パフォーマンス, ストア提出 |

### 推奨開発順序

```
Step 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
                                           ↑
                                ここまでモックデータで開発可能
                                Step 9 で Supabase に切り替え
```

> **Tips**: Step 2〜8 はモックデータで UI を作り込み、Step 9 で一気に Supabase に接続するのが効率的です。
