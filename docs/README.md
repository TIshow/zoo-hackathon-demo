# しゃべれっさー！ 技術ドキュメント

このディレクトリには、「しゃべれっさー！」アプリケーションの詳細な技術ドキュメントが含まれています。

## 📚 ドキュメント構成

### アーキテクチャ

システム全体の設計と データフローを解説

- **[データフロー全体図](./architecture/data-flow.md)**
  - メインフロー（ユーザー入力 → 音声合成 → 解析 → 会話履歴）
  - State 管理の詳細
  - データの依存関係
  - エラーハンドリング
  - パフォーマンス最適化

### 機能別ドキュメント

各システムの詳細実装を解説

#### [音声解析システム](./features/audio-analysis.md)
- **AnalyserBridge**: Web Audio API の AnalyserNode ラッパー
- **特徴量抽出**: RMS、Spectral Centroid、ZCR の計算
- **FeatureAggregator**: 複数フレームの集計
- **Intent 分類**: 4つの意図（greeting/hungry/playful/random）判定
- **パンダ語翻訳**: Intent に応じた音声パターン生成

#### [粒合成風音声再生](./features/speech-synthesis.md)
- **粒合成**: MP3 を短い粒に分けてランダム再生
- **パラメータ**: ピッチ変化、速度変化、リバーブ
- **Intent 連動**: あいさつ・はらぺこ・あそぼで特性が変化
- **モバイル対応**: iOS/Android の音声制限対応
- **解析統合**: AnalyserBridge 経由でリアルタイム解析

#### [親密度学習システム](./features/intimacy-system.md)
- **会話記録**: localStorage ベースの永続化
- **親密度計算**: 会話回数・時間・頻度・継続性から 0-100 スコア
- **スタイル学習**: gentle/energetic/playful/mixed を自動判定
- **マイルストーン**: 特別な称号の解放システム
- **パラメータ調整**: 親密度に応じて音声特性を変化

### コンポーネント詳細

主要コンポーネントの実装を解説

#### [page.tsx 詳細](./components/page.md)
- **責務**: 会話管理、音声合成、音声解析、親密度学習の統合
- **State 管理**: 25個以上の State と Ref の管理方法
- **performSpeech()**: 音声合成・解析・会話記録を統合的に実行
- **useEffect フック**: クライアント初期化とクリーンアップ
- **SSR 対応**: Next.js App Router での SSR/CSR ハイブリッド実装

## 🎯 ドキュメントの使い方

### 初めて読む方

1. **[データフロー全体図](./architecture/data-flow.md)** を最初に読む
   - システム全体の流れを把握
   - 各機能の役割を理解

2. 興味のある機能のドキュメントを読む
   - [音声解析](./features/audio-analysis.md): スペクトラム解析の仕組み
   - [粒合成](./features/speech-synthesis.md): 毎回違う音の生成方法
   - [親密度](./features/intimacy-system.md): 学習システムの実装

3. **[page.tsx 詳細](./components/page.md)** で統合方法を理解
   - すべての機能がどう連携しているか
   - State の流れと更新タイミング

### 機能を追加・修正する方

1. **該当する機能のドキュメント**を読む
   - 現在の実装を正確に把握
   - 関数の引数・戻り値を確認

2. **データフロー図**で影響範囲を確認
   - 変更が他の機能に与える影響
   - State の依存関係

3. **page.tsx 詳細**で統合コードを確認
   - 変更箇所の特定
   - エラーハンドリングの方法

### デバッグ時

各ドキュメントの「デバッグ」セクションを参照

- [音声解析のデバッグ](./features/audio-analysis.md#デバッグ)
- [粒合成のデバッグ](./features/speech-synthesis.md#デバッグ)
- [親密度のデバッグ](./features/intimacy-system.md#デバッグ)
- [page.tsx のログ](./components/page.md#デバッグログ)

## 📋 クイックリファレンス

### 主要ファイルの場所

```
src/
├── app/
│   └── page.tsx                      # メインページ（すべての統合）
├── lib/
│   ├── audio/
│   │   ├── analyserBridge.ts         # AnalyserNode ラッパー
│   │   ├── featureExtractor.ts       # 特徴量抽出
│   │   └── intentClassifier.ts       # Intent 分類
│   ├── pandaSpeech.ts                # 粒合成音声再生
│   └── pandaLearning.ts              # 親密度学習
└── components/
    ├── ChatHistory.tsx               # 会話履歴表示
    ├── StatusPanel.tsx               # ステータスパネル
    └── FixedInputArea.tsx            # 入力エリア
```

### 主要な型定義

```
src/types/
├── audio.d.ts                        # 音声解析関連の型
└── speech.d.ts                       # 音声認識関連の型
```

### データフロー概略図

```
ユーザー入力
  ↓
performSpeech()
  ├─ 音声合成 (pandaSpeech.ts)
  ├─ 解析 (analyserBridge.ts → featureExtractor.ts → intentClassifier.ts)
  ├─ 親密度更新 (pandaLearning.ts)
  └─ 履歴追加 (chatMessages)
  ↓
UI 更新
  ├─ ChatHistory
  ├─ StatusPanel
  └─ IntimacyGauge
```

## 🔧 カスタマイズポイント

### 解析パラメータの調整

- **[音声解析システム - 調整可能なパラメータ](./features/audio-analysis.md#調整可能なパラメータ)**
  - AnalyserBridge 設定
  - Intent 分類閾値
  - サンプリング頻度

### 音声パラメータの調整

- **[粒合成システム - カスタマイズ例](./features/speech-synthesis.md#カスタマイズ例)**
  - 粒数・間隔の変更
  - ピッチ・速度範囲の変更
  - リバーブの強化

### 親密度システムの調整

- **[親密度システム - デバッグ](./features/intimacy-system.md#デバッグ)**
  - マイルストーン条件の変更
  - スコア計算式の調整
  - スタイル学習キーワードの追加

## 🐛 トラブルシューティング

### 音声が再生されない

1. **[粒合成システム - エラーハンドリング](./features/speech-synthesis.md#エラーハンドリング)**
2. **[page.tsx - AudioContext 初期化](./components/page.md#音声合成失敗)**

### 解析結果が表示されない

1. **[音声解析システム - エラーハンドリング](./features/audio-analysis.md#エラーハンドリング)**
2. **[データフロー - 解析結果の永続化](./architecture/data-flow.md#重要なタイミング)**

### 親密度が更新されない

1. **[親密度システム - localStorage 管理](./features/intimacy-system.md#localstorage-管理)**
2. **[page.tsx - 親密度システム更新](./components/page.md#performspeech)**

### SSR エラー

1. **[page.tsx - SSR 対応](./components/page.md#ssr-対応)**
2. **[親密度システム - SSR 対応](./features/intimacy-system.md#localstorage-管理)**

## 📊 パフォーマンス情報

各ドキュメントの「パフォーマンス」セクションを参照

- [音声解析 - CPU/メモリ使用量](./features/audio-analysis.md#パフォーマンス考慮)
- [粒合成 - メモリ使用量](./features/speech-synthesis.md#パフォーマンス考慮)
- [親密度 - 計算コスト](./features/intimacy-system.md#パフォーマンス)

## 🔗 外部リンク

- [プロジェクト README](../README.md)
- [西山動物園公式サイト](https://www.city.sabae.fukui.jp/nishiyama_zoo/)

## 📝 ドキュメントの更新

ドキュメントは実装と同期して更新してください。

### 更新が必要なケース

- 新機能の追加
- 既存機能の変更
- バグ修正による実装変更
- パフォーマンス最適化

### 更新方法

1. 該当するドキュメントを編集
2. コード例や型定義を最新に更新
3. 関連ドキュメントへのリンクを確認
4. 変更履歴をコミットメッセージに記載

---

**最終更新**: 2025-01-16
