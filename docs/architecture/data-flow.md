# データフロー全体図

## 概要

このドキュメントでは、「しゃべれっさー！」アプリケーション全体のデータフローを解説します。

## メインフロー

### 1. ユーザー入力 → 音声合成・解析 → 会話履歴

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザー入力                          │
│  - テキスト入力（FixedInputArea）                            │
│  - 音声入力（VoiceInput + Web Speech API）                  │
│  - クイックチップス（QuickChips）                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    performSpeech() 実行                      │
│  場所: src/app/page.tsx:145-440                              │
│                                                              │
│  1. ユーザーメッセージを chatMessages に追加                │
│  2. 考え中状態表示（250ms）                                  │
│  3. 返答選択（selectPandaReply）                            │
│  4. AudioContext 初期化                                      │
│  5. AnalyserBridge 作成（解析有効時）                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    音声合成 + 解析実行                       │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │  speakLikePandaWithAnalysis() 並列処理          │        │
│  │  場所: src/lib/pandaSpeech.ts:247                │        │
│  │                                                  │        │
│  │  [音声合成スレッド]        [解析スレッド]       │        │
│  │  ・粒合成再生              ・50ms間隔サンプリング│        │
│  │  ・ピッチ変化              ・特徴量抽出          │        │
│  │  ・速度変化                ・FeatureAggregator  │        │
│  │  ・リバーブ                  に蓄積              │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      解析結果の生成                          │
│                                                              │
│  1. FeatureAggregator.getAggregate()                        │
│     - RMS平均・最大値                                        │
│     - Spectral Centroid平均・最大値                         │
│     - ZCR平均                                                │
│     - サンプル数                                             │
│                                                              │
│  2. IntentClassifier.classify()                             │
│     - 特徴量から Intent 判定                                 │
│     - 信頼度スコア計算                                       │
│                                                              │
│  3. パンダ語・翻訳生成                                       │
│     - getRandomPandaSound()                                 │
│     - getRandomTranslation()                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    解析結果の永続化                          │
│  場所: src/app/page.tsx:369-374                              │
│                                                              │
│  setLatestAnalysisResult({                                  │
│    intentResult,    // Intent分類結果                        │
│    pandaSound,      // パンダ語                              │
│    translation,     // 日本語訳                              │
│    grainTimeline    // 粒合成タイムライン                    │
│  })                                                          │
│                                                              │
│  ※音声終了後も保持される                                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  親密度システム更新                          │
│  場所: src/app/page.tsx:298-333                              │
│                                                              │
│  recordConversation()                                       │
│  - 総会話数 +1                                               │
│  - 訪問日追跡（uniqueDays, consecutiveDays）                │
│  - セッション時間記録                                        │
│  - 質問頻度カウント                                          │
│  - 親密度レベル計算                                          │
│  - マイルストーン判定                                        │
│                                                              │
│  savePandaMemory() → localStorage                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              会話履歴への追加（音声終了後）                  │
│  場所: src/app/page.tsx:414-433                              │
│                                                              │
│  setChatMessages([                                          │
│    ...prev,                                                 │
│    {                                                        │
│      type: 'panda',                                         │
│      content: reply.src,                                    │
│      reply,                                                 │
│      analysisData: {        // 解析データを紐付け           │
│        intentResult,                                        │
│        pandaSound,                                          │
│        translation,                                         │
│        grainTimeline                                        │
│      }                                                      │
│    }                                                        │
│  ])                                                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        UI 更新                               │
│                                                              │
│  1. ChatHistory                                             │
│     - 会話履歴表示                                           │
│     - 解析結果の折りたたみ表示                               │
│                                                              │
│  2. StatusPanel                                             │
│     - 最新解析結果のリアルタイム表示                         │
│     - 親密度ゲージ更新                                       │
│     - 学習状況表示                                           │
│                                                              │
│  3. マイルストーン通知（該当時）                            │
└─────────────────────────────────────────────────────────────┘
```

## State 管理

### メインの State（src/app/page.tsx）

| State 名 | 型 | 用途 | 永続化 |
|---------|----|----|------|
| `chatMessages` | `ChatMessage[]` | 会話履歴 | ❌ |
| `latestAnalysisResult` | `{intentResult, pandaSound, translation, grainTimeline}` | 最新の解析結果（永続） | ❌ |
| `pandaMemory` | `PandaMemory` | 親密度・学習データ | ✅ localStorage |
| `analyserBridge` | `AnalyserBridge \| null` | 音声解析ブリッジ | ❌ |
| `isAnalysisEnabled` | `boolean` | 解析機能ON/OFF | ❌ |
| `isSpeaking` | `boolean` | 発話中フラグ | ❌ |
| `isThinking` | `boolean` | 考え中フラグ | ❌ |
| `isAnalyzing` | `boolean` | 解析中フラグ | ❌ |

### データの流れ

1. **一時データ（解析中のみ）**
   ```
   currentIntentResult
   currentPandaSound
   currentTranslation
   currentGrainTimeline
   ```
   → 音声再生中のみ有効

2. **永続データ（音声終了後も保持）**
   ```
   latestAnalysisResult
   ```
   → StatusPanel でリアルタイム表示
   → 音声終了時に chatMessages に添付

3. **永続データ（localStorage）**
   ```
   pandaMemory
   ```
   → ページリロード後も保持
   → 親密度・マイルストーン情報

## 重要なタイミング

### 音声再生開始時
```typescript
// page.tsx:156-162
setCurrentIntentResult(null)    // 前回の解析結果をクリア
setCurrentPandaSound('')
setCurrentTranslation('')
setCurrentGrainTimeline([])
```

### 音声再生中
```typescript
// page.tsx:233-244
analysisIntervalRef.current = setInterval(() => {
  const features = extractFeatures(frequencyData, timeData)
  featureAggregatorRef.current.addSample(features)  // 50ms毎にサンプリング
}, 50)
```

### 音声終了時
```typescript
// page.tsx:411-434
setTimeout(() => {
  setIsSpeaking(false)

  // パンダメッセージを会話履歴に追加（解析データ付き）
  setChatMessages(prev => [...prev, {
    type: 'panda',
    analysisData: latestAnalysisResult  // 永続化されたデータを使用
  }])
}, finalDuration * 1000)
```

## データの依存関係

```
performSpeech
  ├─ selectPandaReply (data/replies.ts)
  ├─ speakLikePandaWithAnalysis (lib/pandaSpeech.ts)
  │   ├─ createAnalyser (lib/audio/analyserBridge.ts)
  │   ├─ extractFeatures (lib/audio/featureExtractor.ts)
  │   └─ IntentClassifier (lib/audio/intentClassifier.ts)
  ├─ recordConversation (lib/pandaLearning.ts)
  │   └─ savePandaMemory → localStorage
  └─ setChatMessages
      └─ ChatHistory コンポーネントで表示
```

## エラーハンドリング

### AnalyserBridge 作成失敗時
```typescript
// page.tsx:196-206
if (!currentAnalyserBridge) {
  try {
    const analyser = createAnalyser(audioContextRef.current)
    setAnalyserBridge(analyser)
  } catch (error) {
    console.error('❌ Failed to create analyser:', error)
    // 従来の方式にフォールバック
  }
}
```

### サンプル数ゼロ時
```typescript
// page.tsx:377-400
if (aggregate.sampleCount === 0) {
  // フォールバック結果を生成
  const fallbackResult = createSafeAnalysisResult('fallback')
  setLatestAnalysisResult(fallbackResult)
}
```

## パフォーマンス最適化

1. **解析サンプリング頻度**: 50ms（20Hz）
2. **考え中演出**: 250ms（体感速度とのバランス）
3. **音声終了マージン**: +500ms（確実に再生完了を待つ）
4. **dynamic import**: CSR専用コンポーネント（SSR回避）

## 関連ドキュメント

- [音声解析システム](../features/audio-analysis.md)
- [粒合成システム](../features/speech-synthesis.md)
- [親密度システム](../features/intimacy-system.md)
- [page.tsx 詳細](../components/page.md)
