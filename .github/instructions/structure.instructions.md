---
description: "プロジェクト構造、ディレクトリ構成、ファイル配置に関する作業で使用。app, src, components, hooks, lib, constants, types, ファイル構成, ディレクトリ"
applyTo: "**/*.tsx, **/*.ts"
---
# プロジェクト構造ガイド

## ディレクトリ構成

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

## 命名規則

- コンポーネントファイル: PascalCase（例: `ParticipantModal.tsx`）
- 画面ファイル: kebab-case（例: `login.tsx`, `onboarding.tsx`）
- ユーティリティ・定数: camelCase（例: `colors.ts`, `supabase.ts`）

## ファイル配置ルール

- **app/**: 画面とルーティング（Expo Router）
- **src/components/**: 再利用可能なUIコンポーネント
- **src/hooks/**: カスタムフック
- **src/lib/**: 外部ライブラリのクライアント設定
- **src/constants/**: 定数定義
- **src/types/**: 型定義
- **src/data/**: モックデータ
