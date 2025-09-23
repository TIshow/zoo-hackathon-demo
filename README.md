# 🐼 レッサーパンダトーク - Zoo Hackathon Demo

レッサーパンダとの擬似会話を楽しめるWebデモアプリです。

## 📋 概要

- **フレームワーク**: Next.js 15 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS v4
- **機能**: ルールベースの音声返答システム
- **対応デバイス**: デスクトップ・モバイル（iOS/Android）
- **デプロイ**: Vercel対応

## 🎯 機能

### 🗣️ 会話機能
- ユーザー入力に基づいてレッサーパンダが応答
- タグマッチングによる適切な返答選択
- 一致しない場合はランダム返答

### 🎵 音声再生
- 3種類のレッサーパンダボイス（MP3）
- はらぺこ系・あそぼ系・あいさつ系
- モバイルデバイス対応

### 💬 プリセット質問
- 「こんにちは！」
- 「ごはん何が好き？」
- 「あそぼ！」
- 「おまかせで鳴く」

## 🚀 セットアップ

### 前提条件
- Node.js 18.17以上
- npm / yarn / pnpm

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd zoo-hackathon-demo

# 依存関係をインストール
npm install
```

### MP3ファイルの配置

以下のパスに音声ファイルを配置してください：

```
public/sounds/
├── red_panda_voice1.mp3  # はらぺこ系
├── red_panda_voice2.mp3  # あそぼ系
└── red_panda_voice3.mp3  # あいさつ系
```

### 開発サーバー起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 📁 プロジェクト構成

```
zoo-hackathon-demo/
├── public/
│   └── sounds/           # MP3音声ファイル
├── src/
│   ├── app/
│   │   ├── globals.css   # グローバルスタイル
│   │   ├── layout.tsx    # レイアウト
│   │   └── page.tsx      # メインページ
│   ├── components/
│   │   ├── Bubble.tsx    # 吹き出しコンポーネント
│   │   └── QuickChips.tsx # プリセット質問ボタン
│   └── data/
│       └── replies.ts    # 返答ルールとロジック
├── README.md
└── package.json
```

## 🌐 Vercel デプロイ

### 自動デプロイ（推奨）

1. [Vercel](https://vercel.com) にログイン
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. プロジェクト設定はデフォルトのまま「Deploy」

### 手動デプロイ

```bash
# Vercel CLIをインストール
npm i -g vercel

# プロジェクトルートでデプロイ
vercel

# 本番デプロイ
vercel --prod
```

### 環境設定

Vercelでは特別な設定は不要です。Next.jsプロジェクトとして自動認識されます。

## 🔧 カスタマイズ

### 返答の追加・編集

`src/data/replies.ts` を編集：

```typescript
export const PANDA_REPLIES: PandaReply[] = [
  {
    id: 4,
    src: "/sounds/new_voice.mp3",
    translation: "新しい返答メッセージ",
    tags: ["新しい", "タグ", "キーワード"],
  },
  // ...
];
```

### プリセット質問の変更

`src/components/QuickChips.tsx` の `QUICK_QUESTIONS` 配列を編集

### スタイルの調整

Tailwind CSSクラスを使用してスタイリングを調整可能

## ⚠️ 注意事項

- **音声について**: ブラウザの自動再生ポリシーにより、ユーザーインタラクション後に音声が再生されます
- **翻訳について**: 表示される翻訳は演出用であり、実際の動物の意思疎通ではありません
- **ファイルサイズ**: MP3ファイルのサイズにご注意ください（推奨: 1ファイル5MB以下）
- **ブラウザ対応**: モダンブラウザ（Chrome, Safari, Firefox, Edge）で動作確認済み

## 🏗️ ビルド・テスト

```bash
# プロダクションビルド
npm run build

# ビルド後のローカル確認
npm run start

# リント確認
npm run lint
```

## 📄 ライセンス

このプロジェクトは動物園ハッカソン用のデモアプリケーションです。

## 🎪 園内案内

🎵 **園内限定の特別ボイス**をお楽しみいただけます！
ぜひ実際の動物園にも遊びに来てくださいね 🐾
