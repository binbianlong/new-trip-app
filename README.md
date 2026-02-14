# new-trip-app

React Native (Expo) を使用した旅行アプリです。

## 前提条件

- **Node.js** 20.20.0
- **npm** 10.8.2
- **Git**

> **Node.jsのバージョン管理**: nvm/nodenv/asdf等を使用している場合、`.nvmrc` / `.node-version` ファイルに基づいて自動的にバージョンが切り替わります。

## 環境構築手順

### 0. Node.js のセットアップ

#### nvm で Node.js 20 をインストール

nvm を使って Node.js 20 を入れます。

```bash
nvm install 20
nvm use 20
node --version
npm --version
```

`v20.x.x` と `10.8.2` が出れば OK。

> Node.js 20.20.0 には npm 10.8.2 が付属しています。

#### nvm がインストールされていない場合

**1) nvm をインストール**

ターミナルで以下を実行：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

**2) ターミナルを再起動して確認**

```bash
nvm -v
```

バージョンが表示されれば成功です。その後、上記の「nvm で Node.js 20 をインストール」手順を実行してください。

---

### 1. リポジトリをクローン

```bash
git clone <リポジトリURL>
cd new-trip-app
```

> **Node.jsバージョンの確認**: nvm使用者は `nvm use` でバージョンを切り替えてください。

### 2. 依存パッケージをインストール

```bash
np**注意**: `.npmrc` により `engine-strict=true` が設定されているため、Node.js/npm のバージョンが package.json の `engines` フィールドと一致しない場合、インストールが失敗します。  
> m install
```

> `npm install` を実行すると、`prepare` スクリプトにより Husky の Git フックが自動的にセットアップされます。

### 3. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の内容を追加してください。

```env
# Supabase 設定
EXPO_PUBLIC_SUPABASE_URL=https://gpkufxnxkbtdqdwjviir.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

> **参考**: `.env.example` ファイルをコピーして `.env` を作成できます。  
> `.env` ファイルは `.gitignore` に含まれているため、Git にコミットされません。

### 4. アプリを起動

```bash
npm start
```

プラットフォームごとに起動する場合：

```bash
npm run android
npm run ios
npm run web
```

---

## VS Code 拡張機能（推奨）

プロジェクトを VS Code で開くと、以下の拡張機能のインストールが推奨されます：

- **Biome** (`biomejs.biome`) - Lint/Format のリアルタイム表示と自動修正

### 拡張機能をインストール

1. VS Code でプロジェクトを開く
2. 右下に表示される「推奨される拡張機能をインストールしますか？」で **インストール** をクリック

または、拡張機能パネル（`Ctrl+Shift+X` / `Cmd+Shift+X`）から `@recommended` で検索してインストールできます。

### 自動設定

`.vscode/settings.json` により、以下が自動で有効化されます：

- 保存時に自動フォーマット
- 保存時にimport文の自動整理
- Biome をデフォルトフォーマッターに設定

---

## npm スクリプト一覧

| コマンド | 説明 |
| --- | --- |
| `npm start` | Expo 開発サーバーを起動 |
| `npm run android` | Android で起動 |
| `npm run ios` | iOS で起動 |
| `npm run web` | Web で起動 |
| `npm run lint` | Biome による lint/format チェック |
| `npm run lint:fix` | Biome による lint/format の自動修正 |
| `npm run format` | Biome によるフォーマット |
| `npm run typecheck` | TypeScript の型チェック |

## Git フック (Husky)

Husky により以下の Git フックが自動実行されます。

### pre-commit

コミット時に **lint-staged** を介して、ステージされたファイル (`*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.json`) に対して **Biome** の lint/format チェック＆自動修正が実行されます。

### pre-push

プッシュ時に **TypeScript の型チェック** (`tsc --noEmit`) が実行されます。型エラーがある場合、プッシュがブロックされます。

## 技術スタック

- **React Native** (Expo SDK 54)
- **TypeScript**
- **Supabase** - Backend & Database
- **Biome** - Linter / Formatter
- **Husky** - Git フック管理
- **lint-staged** - ステージファイルへの lint 実行
