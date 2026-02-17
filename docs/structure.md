# プロジェクト構造

## ディレクトリ構成

```
app/
├── _layout.tsx              # ルートレイアウト (Stack)
├── (tabs)/
│   ├── _layout.tsx          # タブレイアウト (ホーム / マップ)
│   ├── index.tsx            # ホーム画面
│   └── map.tsx              # マップ画面
├── login.tsx                # サインアップ画面
├── onboarding.tsx           # ユーザー情報入力画面
├── create.tsx               # 旅行プラン作成画面
└── trip/
    └── [id].tsx             # 旅行プラン詳細画面

src/
├── constants/
│   └── colors.ts            # カラーパレット
├── types/
│   └── index.ts             # 型定義
├── data/
│   └── mock.ts              # モックデータ
├── components/
│   └── ParticipantModal.tsx # 参加者追加モーダル
├── lib/
│   └── supabase.ts          # Supabase クライアント
└── hooks/
    └── useAuth.ts           # 認証 Hook
```

## 各ディレクトリの役割

### `app/`

Expo Router による画面とルーティングを管理。

- **`_layout.tsx`**: 各階層のレイアウト設定
- **`(tabs)/`**: タブナビゲーションを使用する画面群
- **`login.tsx`**: 認証画面
- **`onboarding.tsx`**: 初回登録時のユーザー情報入力画面
- **`create.tsx`**: 旅行プラン作成画面
- **`trip/[id].tsx`**: 動的ルーティングによる旅行詳細画面

### `src/components/`

再利用可能な UI コンポーネント。

- モーダル
- カード
- ボタン
- その他共通コンポーネント

### `src/hooks/`

カスタムフック。

- 認証
- データフェッチ
- 状態管理

### `src/lib/`

外部ライブラリのクライアント設定。

- Supabase クライアント
- その他 API クライアント

### `src/constants/`

定数定義。

- カラーパレット
- サイズ
- 設定値

### `src/types/`

TypeScript の型定義。

- データモデル
- API レスポンス型
- Props 型

### `src/data/`

モックデータ。

- 開発用テストデータ

## 命名規則

- **コンポーネントファイル**: PascalCase（例: `ParticipantModal.tsx`）
- **画面ファイル**: kebab-case（例: `login.tsx`, `onboarding.tsx`）
- **ユーティリティ・定数**: camelCase（例: `colors.ts`, `supabase.ts`）
- **フック**: `use` + PascalCase（例: `useAuth.ts`）

## ファイル作成時の注意

- コンポーネントは関数コンポーネントで作成
- TypeScript で型安全に記述
- 日本語でコメントを記述
- 適切なディレクトリに配置
