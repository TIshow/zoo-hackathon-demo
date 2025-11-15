# 🐼 しゃべれっさー！

レッサーパンダとの擬似会話を楽しめる Web デモアプリです。

**特徴**: Web Audio API の「粒合成風」再生と AI 音声解析により、毎回少し違う鳴き方を演出し、"生成っぽい"体験を提供します。

## 📋 概要

- **フレームワーク**: Next.js 15 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS v4
- **音声技術**: Web Audio API（粒合成風再生 + リアルタイムスペクトラム解析）
- **機能**: ルールベースの音声返答 + AI 音声解析 + 親密度学習システム
- **対応デバイス**: デスクトップ・モバイル（iOS/Android）
- **デプロイ**: Vercel 対応（外部 API 不要）

## 🎯 主要機能

### 1. 🗣️ チャット会話システム

- **会話履歴表示**: ユーザーとパンダのメッセージを時系列で表示
- **タグマッチング**: ユーザー入力に基づいて適切な返答を選択
- **音声入力対応**: Web Speech API による音声認識
- **クイックチップス**: よく使う質問のプリセットボタン
- **考え中...演出**: 250ms の思考時間表示

### 2. 🎵 粒合成風音声再生

- **毎回違う鳴き方**: MP3 を短い粒に分けてランダム再生
- **ピッチ変化**: ±3 半音の変化で表情豊かに
- **速度変化**: 0.85〜1.15 倍でゆらぎを演出
- **簡易リバーブ**: 空間的な広がりを追加
- **3 種類のベース音源**: はらぺこ系・あそぼ系・あいさつ系
- **モバイル対応**: iOS/Android の音声制限に完全対応

### 3. 🔬 AI 音声解析システム

#### リアルタイムスペクトラム解析
- **AnalyserBridge**: Web Audio API の AnalyserNode をラップ
- **特徴量抽出**: RMS（音量）、Spectral Centroid（音色）、ZCR（周波数）
- **50ms サンプリング**: 20Hz でリアルタイム解析
- **可視化**: スペクトラムパネルで周波数分布を表示

#### Intent 分類システム
- **4 つの意図**: greeting（あいさつ）、hungry（はらぺこ）、playful（あそぼ）、random（ランダム）
- **信頼度スコア**: 特徴量に基づく分類精度
- **パンダ語翻訳**: Intent に応じたパンダ語と日本語訳を生成
- **Grain Timeline**: 粒合成の再生タイミングを記録

#### 解析結果の永続化
- **会話履歴に紐付け**: 各メッセージに解析結果を保存
- **折りたたみ表示**: 過去の解析結果を詳細表示可能
- **ステータスパネル**: 最新の解析結果をリアルタイム表示

### 4. 🧠 親密度学習システム

- **会話トラッキング**: 総会話数、訪問日数、連続日数を記録
- **親密度レベル**: 0〜100 のスコアで関係性を数値化
- **マイルストーン解放**: 特定条件で特別な称号を獲得
  - おしゃべり好き（10 回会話）
  - 親密な友達（30 回会話）
  - 常連さん（5 日間訪問）
  - 1 週間の友（7 日連続訪問）
  - 朝の友達（早朝訪問）
  - 夜ふかし友達（深夜訪問）
  - おしゃべり上手（長時間セッション）
- **パラメータ調整**: 親密度に応じて音声パラメータが変化
- **シェアカード生成**: 親密度をSNSでシェア可能

### 5. 💬 UI コンポーネント

#### メイン画面
- **ChatHistory**: 会話履歴の表示と解析結果の折りたたみ表示
- **FixedInputArea**: 固定入力エリア（テキスト/音声入力/クイックチップス）
- **StatusPanel**: フローティングステータスパネル（解析結果/親密度/設定）

#### 解析表示
- **SpectrumPanel**: リアルタイムスペクトラム可視化
- **TranslationCaption**: AI 翻訳結果とパンダ語表示
- **IntimacyGauge**: 親密度ゲージとレベル表示

#### その他
- **VoiceInput**: 音声入力インターフェース
- **MilestoneNotification**: マイルストーン解放通知
- **ShareCardGenerator**: SNS シェアカード生成

## 🚀 セットアップ

### 前提条件

- Node.js 20 以上
- npm / yarn / pnpm

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd zoo-hackathon-demo

# 依存関係をインストール
npm install
```

### MP3 ファイルの配置（重要）

以下のパスに音声ファイルを配置してください：

```
public/sounds/
├── red_panda_voice1.mp3  # はらぺこ系（粒合成のベース音源）
├── red_panda_voice2.mp3  # あそぼ系（粒合成のベース音源）
└── red_panda_voice3.mp3  # あいさつ系（粒合成のベース音源）
```

**注意**: ファイル名は厳守してください。Web Audio API が各ファイルを読み込んで粒合成処理を行います。

### 開発サーバー起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 📁 プロジェクト構成

```
zoo-hackathon-demo/
├── public/
│   └── sounds/                    # MP3音声ファイル（粒合成ベース）
├── src/
│   ├── app/
│   │   ├── globals.css            # グローバルスタイル
│   │   ├── layout.tsx             # レイアウト
│   │   └── page.tsx               # メインページ（会話管理・音声解析統合）
│   ├── components/
│   │   ├── Bubble.tsx             # 吹き出しコンポーネント
│   │   ├── ChatHistory.tsx        # チャット履歴表示
│   │   ├── FixedInputArea.tsx     # 固定入力エリア
│   │   ├── IntimacyGauge.tsx      # 親密度ゲージ
│   │   ├── IntimacyGaugeClient.tsx # 親密度ゲージ（CSR版）
│   │   ├── MilestoneNotification.tsx # マイルストーン通知
│   │   ├── QuickChips.tsx         # プリセット質問ボタン
│   │   ├── ShareCardGenerator.tsx # シェアカード生成
│   │   ├── SpectrumPanel.tsx      # スペクトラム可視化
│   │   ├── StatusPanel.tsx        # ステータスパネル
│   │   ├── TranslationCaption.tsx # AI翻訳表示
│   │   └── VoiceInput.tsx         # 音声入力
│   ├── config/
│   │   └── analysisConfig.ts      # 解析設定
│   ├── data/
│   │   └── replies.ts             # 返答ルールとロジック
│   ├── hooks/
│   │   └── useAudioAnalysis.ts    # 音声解析カスタムフック
│   ├── lib/
│   │   ├── audio/
│   │   │   ├── analyserBridge.ts  # AnalyserNode ラッパー
│   │   │   ├── audioContextHelper.ts # AudioContext ヘルパー
│   │   │   ├── featureExtractor.ts # 特徴量抽出
│   │   │   └── intentClassifier.ts # Intent 分類
│   │   ├── audioRecording.ts      # 音声録音
│   │   ├── pandaLearning.ts       # 親密度学習システム
│   │   ├── pandaSpeech.ts         # Web Audio API 粒合成システム
│   │   ├── shareCard.ts           # シェアカード生成
│   │   └── speechRecognition.ts   # 音声認識
│   ├── types/
│   │   ├── audio.d.ts             # 音声解析型定義
│   │   └── speech.d.ts            # 音声認識型定義
│   └── utils/
│       └── speechUtils.ts         # 音声ユーティリティ
├── README.md
└── package.json
```

## 🏗️ アーキテクチャ

### データフロー

```
ユーザー入力 → performSpeech()
  ↓
音声合成開始 + AnalyserBridge 初期化
  ↓
特徴量抽出（50ms 間隔サンプリング）
  ↓
Intent 分類 + パンダ語生成
  ↓
解析結果を latestAnalysisResult に永続化
  ↓
ChatHistory にメッセージ + 解析データ追加
  ↓
StatusPanel で最新結果をリアルタイム表示
```

### 音声解析パイプライン

```
AudioContext
  ↓
粒合成再生（pandaSpeech.ts）
  ↓
AnalyserBridge（analyserBridge.ts）
  ↓
特徴量抽出（featureExtractor.ts）
  ├─ RMS（音量）
  ├─ Spectral Centroid（音色）
  └─ ZCR（周波数）
  ↓
FeatureAggregator（集計）
  ↓
IntentClassifier（分類）
  ↓
Intent Result + パンダ語 + 翻訳
```

### 親密度システム

```
会話記録
  ↓
recordConversation()
  ├─ 総会話数 +1
  ├─ 訪問日追跡
  ├─ 連続日数計算
  ├─ セッション時間記録
  └─ 質問頻度カウント
  ↓
親密度スコア計算
  ├─ 会話数ベース
  ├─ 訪問頻度ベース
  └─ 時間帯ベース
  ↓
マイルストーン判定
  ↓
音声パラメータ調整
```

## 🌐 Vercel デプロイ

### 自動デプロイ（推奨）

1. [Vercel](https://vercel.com) にログイン
2. 「New Project」をクリック
3. GitHub リポジトリを選択
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

Vercel では特別な設定は不要です。Next.js プロジェクトとして自動認識されます。

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

### 解析パラメータの調整

`src/config/analysisConfig.ts` で解析設定を変更可能

### 親密度レベルの調整

`src/lib/pandaLearning.ts` の `INTIMACY_LEVELS` 配列を編集

### スタイルの調整

Tailwind CSS クラスを使用してスタイリングを調整可能

## ⚠️ 注意事項

### 🔊 音声について

- **初回操作必須**: iOS/Android の自動再生制限により、初回は必ずボタンタップから開始
- **Web Audio API**: AudioContext を使用するため、モダンブラウザが必要
- **音量注意**: 粒合成により予期しない音量変化が発生する場合があります
- **リバーブ効果**: 簡易リバーブが適用されるため、ヘッドフォン推奨

### 📱 モバイル対応

- **iOS Safari**: Web Audio API 完全対応、初回タップ後はスムーズに動作
- **Android Chrome**: 動作確認済み、音声認識・解析機能も正常動作
- **レスポンシブ**: 画面サイズに応じて最適化

### 🎭 演出について

- **AI 翻訳**: 表示される翻訳は擬似的な演出です（実際の AI モデルは使用していません）
- **毎回違う音**: 粒合成により同じ入力でも微妙に異なる再生結果
- **生成っぽさ**: アルゴリズムによる音声変化で「AI 生成風」を演出
- **解析結果**: 音響特徴量に基づく分類ですが、実際の意味理解ではありません

### 🧠 親密度システム

- **localStorage 使用**: ブラウザの localStorage に会話データを保存
- **プライバシー**: すべてのデータはローカルに保存され、外部送信されません
- **リセット**: ブラウザのキャッシュクリアでデータリセット可能

### 📂 ファイルサイズ

- MP3 ファイル: 推奨 1 ファイル 5MB 以下
- 粒合成処理: ファイルサイズが大きいと初回読み込みに時間がかかる場合があります

## 🧪 手動受け入れテスト

### 基本機能テスト

1. **画面表示**: タイトル/説明/入力欄/ボタン/チップが正しく表示される
2. **入力テスト**:
   - 「こんにちは！」→ あいさつ系が**毎回少し違う鳴き方**で再生、翻訳表示
   - 「ごはん何が好き？」→ はらぺこ系が同様に再生・表示
   - 「あそぼ！」→ あそぼ系が同様に再生・表示
3. **チャット履歴**: メッセージが時系列で表示される
4. **音声入力**: マイクボタンで音声認識が動作する

### AI 解析機能テスト

5. **スペクトラム表示**: 音声再生中にスペクトラムが動く
6. **Intent 分類**: 解析結果に Intent（greeting/hungry/playful/random）が表示される
7. **パンダ語翻訳**: パンダ語と日本語訳が表示される
8. **解析履歴**: 過去のメッセージで解析結果を折りたたみ表示できる

### 親密度システムテスト

9. **親密度ゲージ**: 会話するごとにゲージが上昇する
10. **マイルストーン**: 条件達成で通知が表示される
11. **シェアカード**: シェアボタンで SNS 用画像が生成される

### モバイルテスト

12. **iOS Safari**: 初回タップ後、音声が正常に再生される
13. **Android Chrome**: 同様に動作する
14. **レスポンシブ**: 各画面サイズで適切に表示される

### 技術テスト

15. **粒合成確認**: 同じ質問を複数回実行し、毎回微妙に違う再生結果
16. **AudioContext**: ブラウザのコンソールエラーがない
17. **アクセシビリティ**: キーボードナビゲーション・スクリーンリーダー対応

## 🏗️ ビルド・テスト

```bash
# プロダクションビルド
npm run build

# ビルド後のローカル確認
npm run start

# リント確認
npm run lint

# TypeScript型チェック
npx tsc --noEmit
```

## 📄 ライセンス

このプロジェクトは動物園ハッカソン用のデモアプリケーションです。

## 🎪 西山動物園案内

🎵 **園内限定の"特別ボイス"**も準備中！
西山動物園で実際のレッサーパンダに会いに来てくださいね 🐾

### 🔗 リンク

- [西山動物園公式サイト](https://www.city.sabae.fukui.jp/nishiyama_zoo/)

### 💡 技術的な特徴（審査ポイント）

- **完全フロントエンド**: 外部 API 不使用、Vercel だけで動作
- **生成っぽさ**: Web Audio API の粒合成で毎回違う鳴き方を実現
- **AI 音声解析**: リアルタイムスペクトラム解析 + Intent 分類
- **学習システム**: 親密度トラッキングによるパーソナライズ
- **チャット UI**: 会話履歴と解析結果の統合表示
- **リアルタイム性**: ユーザー操作に即応、解析結果の即時反映
- **モバイル最適化**: iOS/Android の音声制限に完全対応
- **アクセシビリティ**: WCAG 準拠、キーボード・スクリーンリーダー対応
- **プライバシー配慮**: すべてのデータをローカル保存、外部送信なし
