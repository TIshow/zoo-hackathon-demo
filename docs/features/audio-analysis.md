# 音声解析システム

## 概要

Web Audio API の AnalyserNode を使用して、レッサーパンダの合成音声をリアルタイム解析し、Intent（意図）を分類するシステムです。

## システム構成

```
音声再生
  ↓
AnalyserBridge (analyserBridge.ts)
  ↓
特徴量抽出 (featureExtractor.ts)
  ├─ RMS (Root Mean Square)
  ├─ Spectral Centroid
  └─ ZCR (Zero Crossing Rate)
  ↓
FeatureAggregator
  ↓
IntentClassifier (intentClassifier.ts)
  ↓
Intent Result + パンダ語 + 翻訳
```

## 1. AnalyserBridge

**場所**: `src/lib/audio/analyserBridge.ts`

### 役割
Web Audio API の AnalyserNode をラップし、周波数データと時間データを取得する

### 主要機能

#### createAnalyser()
```typescript
function createAnalyser(
  context: AudioContext,
  config?: Partial<AnalyserConfig>
): AnalyserBridge
```

**デフォルト設定**:
```typescript
{
  fftSize: 1024,              // FFTサイズ（周波数分解能）
  smoothingTimeConstant: 0.8, // スムージング係数
  minDecibels: -90,           // 最小デシベル
  maxDecibels: -10            // 最大デシベル
}
```

**戻り値**:
```typescript
{
  analyser: AnalyserNode,
  frequencyData: Uint8Array,  // 周波数データバッファ
  timeData: Uint8Array,       // 時間データバッファ
  getFrequencyFrame(): Uint8Array,
  getTimeFrame(): Uint8Array,
  cleanup(): void
}
```

#### 使用例
```typescript
// page.tsx:198-201
const analyser = createAnalyser(audioContextRef.current)
setAnalyserBridge(analyser)

// 音声チェーンに挿入
insertAnalyserIntoChain(sourceNode, destinationNode, analyser)
```

### データ形式

- **周波数データ**: `Uint8Array[512]` (fftSize/2)
  - 各値: 0-255（周波数ビンごとの振幅）
  - インデックス i の周波数: `i * (sampleRate/2) / 512` Hz

- **時間データ**: `Uint8Array[1024]` (fftSize)
  - 各値: 0-255（中央128が0、波形データ）

## 2. 特徴量抽出

**場所**: `src/lib/audio/featureExtractor.ts`

### 抽出する特徴量

#### RMS (Root Mean Square) - 音量指標
```typescript
function getRMS(timeData: Uint8Array): number
```

**計算式**:
```
RMS = sqrt(Σ(sample^2) / N)
```

**範囲**: 0.0 ~ 1.0
- 0.0 に近い: 静か
- 1.0 に近い: 大きい

**用途**: 音量・エネルギーレベルの測定

#### Spectral Centroid - 音色指標
```typescript
function getCentroid(frequencyData: Uint8Array, sampleRate: number): number
```

**計算式**:
```
Centroid = Σ(frequency_i * magnitude_i) / Σ(magnitude_i)
```

**範囲**: 0 ~ 22050 Hz（サンプルレート44.1kHzの場合）
- 低い値: 低音成分が多い（こもった音）
- 高い値: 高音成分が多い（明るい音）

**用途**: 音色の明るさ・暗さの測定

#### ZCR (Zero Crossing Rate) - 周波数変化指標
```typescript
function getZCR(timeData: Uint8Array): number
```

**計算式**:
```
ZCR = (ゼロ交差回数) / (サンプル数 - 1)
```

**範囲**: 0.0 ~ 1.0
- 低い値: トーン的な音（単純な波形）
- 高い値: ノイズ的な音（複雑な波形）

**用途**: 音の複雑さ・ノイズ度合いの測定

### extractFeatures()

全特徴量を一度に抽出:
```typescript
const features = extractFeatures(frequencyData, timeData, sampleRate)
// → { rms: 0.35, centroid: 1500, zcr: 0.12 }
```

## 3. FeatureAggregator

**場所**: `src/lib/audio/featureExtractor.ts:72-112`

### 役割
複数フレームの特徴量を集計し、平均値・最大値を計算

### 使用方法

```typescript
const aggregator = new FeatureAggregator()

// 50ms毎にサンプル追加（page.tsx:233-244）
setInterval(() => {
  const features = extractFeatures(frequencyData, timeData)
  aggregator.addSample(features)
}, 50)

// 集計結果取得
const aggregate = aggregator.getAggregate()
// → {
//   rmsAvg: 0.35,
//   rmsMax: 0.82,
//   centroidAvg: 1500,
//   centroidMax: 2800,
//   zcrAvg: 0.12,
//   sampleCount: 45
// }
```

### 集計データの意味

| フィールド | 説明 |
|-----------|------|
| `rmsAvg` | 平均音量（全体的な大きさ） |
| `rmsMax` | 最大音量（ピーク音量） |
| `centroidAvg` | 平均音色（全体的な明るさ） |
| `centroidMax` | 最大音色（最も明るい部分） |
| `zcrAvg` | 平均ZCR（全体的なノイズ度） |
| `sampleCount` | サンプル数（信頼性の指標） |

## 4. Intent 分類

**場所**: `src/lib/audio/intentClassifier.ts`

### Intent の種類

| Intent | 意味 | 音響的特徴 |
|--------|------|-----------|
| `greeting` | あいさつ | 中音域、中音量、バランス良い |
| `playful` | あそぼ | 高音域、大音量、活発 |
| `hungry` | はらぺこ | 低音域、音量変動大、トーン的 |

### 分類ルール

#### 閾値設定（DEFAULT_THRESHOLDS）
```typescript
{
  centroidLow: 800,     // 低音の閾値（Hz）
  centroidHigh: 2500,   // 高音の閾値（Hz）
  rmsLow: 0.1,          // 静かの閾値
  rmsHigh: 0.4,         // 大きいの閾値
  zcrHigh: 0.15         // ノイズの閾値
}
```

#### スコアリングロジック

**Playful（あそぼ）**:
```typescript
// intentClassifier.ts:82-90
if (centroidAvg > 2500) scores.playful += 0.4  // 高音域
if (rmsAvg > 0.4) scores.playful += 0.3        // 大音量
if (zcrAvg > 0.15) scores.playful += 0.3       // 活発
// 最大スコア: 1.0
```

**Greeting（あいさつ）**:
```typescript
// intentClassifier.ts:93-102
if (800 <= centroidAvg <= 2500) scores.greeting += 0.4  // 中音域
if (0.1 <= rmsAvg <= 0.4) scores.greeting += 0.4        // 中音量
if (zcrAvg < 0.15) scores.greeting += 0.2               // 穏やか
// 最大スコア: 1.0
```

**Hungry（はらぺこ）**:
```typescript
// intentClassifier.ts:105-115
if (centroidAvg < 800) scores.hungry += 0.5           // 低音域
if (rmsAvg < 0.1 || rmsAvg > 0.4) scores.hungry += 0.3  // 極端な音量
if (zcrAvg < 0.105) scores.hungry += 0.2              // トーン的
// 最大スコア: 1.0
```

### classify()

```typescript
const classifier = new IntentClassifier()
const result = classifier.classify(aggregateFeatures)

// → {
//   intent: 'playful',
//   confidence: 0.87,
//   features: { rmsAvg: 0.5, centroidAvg: 2800, ... }
// }
```

### パンダ語・翻訳生成

#### パンダ語パターン（PANDA_SOUND_PATTERNS）
```typescript
greeting: ["キュッ・キュ〜", "クーン・クーン", "キュルル〜", ...]
playful: ["キャッ・キャッ・キャ！", "キュキュキュ〜！", ...]
hungry: ["グルル...キュ〜", "クゥーン...クゥーン", ...]
```

#### 日本語訳（INTENT_TRANSLATIONS）
```typescript
greeting: ["こんにちは！", "やあ、会えて嬉しいよ！", ...]
playful: ["あそぼ〜！", "一緒に走ろうよ！", ...]
hungry: ["お腹すいた〜", "ご飯まだかな？", ...]
```

#### 使用例
```typescript
const pandaSound = classifier.getRandomPandaSound(result.intent)
const translation = classifier.getRandomTranslation(result.intent)

// → pandaSound: "キャッ・キャッ・キャ！"
// → translation: "あそぼ〜！"
```

## 実行フロー（page.tsx での統合）

### 1. 解析開始（音声再生前）
```typescript
// page.tsx:156-162
setCurrentIntentResult(null)  // 前回結果をクリア
setIsAnalyzing(true)
featureAggregatorRef.current.clear()
```

### 2. リアルタイムサンプリング（音声再生中）
```typescript
// page.tsx:233-244
analysisIntervalRef.current = setInterval(() => {
  const frequencyData = analyserBridge.getFrequencyFrame()
  const timeData = analyserBridge.getTimeFrame()
  const features = extractFeatures(frequencyData, timeData)
  featureAggregatorRef.current.addSample(features)
}, 50)  // 20Hz サンプリング
```

### 3. 解析結果の生成（音声終了時）
```typescript
// page.tsx:344-376
clearInterval(analysisIntervalRef.current)

const aggregate = featureAggregatorRef.current.getAggregate()
const intentResult = intentClassifierRef.current.classify(aggregate)
const pandaSound = intentClassifierRef.current.getRandomPandaSound(intentResult.intent)
const translation = intentClassifierRef.current.getRandomTranslation(intentResult.intent)

// 永続化
setLatestAnalysisResult({
  intentResult,
  pandaSound,
  translation,
  grainTimeline
})
```

## パフォーマンス考慮

### サンプリング頻度
- **50ms 間隔** = 20Hz
- 1秒の音声 → 約20サンプル
- 3秒の音声 → 約60サンプル

### メモリ使用量
- AnalyserBridge バッファ: 約 3KB
  - frequencyData: 512 bytes
  - timeData: 1024 bytes
- FeatureAggregator: サンプル数 × 24 bytes
  - 60サンプル → 約 1.4KB

### CPU 負荷
- FFT 計算: AnalyserNode が自動実行（低負荷）
- 特徴量抽出: 50ms毎、配列走査のみ（軽量）
- 分類: 音声終了時に1回のみ（瞬時）

## エラーハンドリング

### AnalyserBridge 作成失敗
```typescript
// page.tsx:196-206
try {
  const analyser = createAnalyser(audioContextRef.current)
  setAnalyserBridge(analyser)
} catch (error) {
  console.error('Failed to create analyser:', error)
  // 解析なしで従来の音声再生にフォールバック
}
```

### サンプル数ゼロ
```typescript
// page.tsx:377-400
if (aggregate.sampleCount === 0) {
  // フォールバック結果を生成（ランダム値）
  const fallbackResult = createSafeAnalysisResult('fallback')
  setLatestAnalysisResult(fallbackResult)
}
```

## 調整可能なパラメータ

### AnalyserBridge
- `fftSize`: 512 / 1024 / 2048（分解能 vs パフォーマンス）
- `smoothingTimeConstant`: 0.0-1.0（応答速度 vs 安定性）

### Intent 分類閾値
```typescript
const classifier = new IntentClassifier({
  centroidLow: 1000,   // デフォルト: 800
  centroidHigh: 3000,  // デフォルト: 2500
  rmsLow: 0.15,        // デフォルト: 0.1
  rmsHigh: 0.5,        // デフォルト: 0.4
  zcrHigh: 0.2         // デフォルト: 0.15
})
```

### サンプリング頻度
```typescript
// page.tsx:244
setInterval(() => { ... }, 50)  // デフォルト: 50ms
// 変更例: 100ms（低負荷）、25ms（高精度）
```

## デバッグ

### コンソールログ
```typescript
// page.tsx:240-242
if (featureAggregatorRef.current.getAggregate().sampleCount % 10 === 0) {
  console.log('📊 Sampling features:', count)
}

// page.tsx:351-360
console.log('📊 Feature aggregate:', aggregate)
console.log('🎯 Classification result:', intentResult)
console.log('🐼 Panda sound:', pandaSound)
console.log('🗣️ Translation:', translation)
```

### 可視化
- **SpectrumPanel**: リアルタイムスペクトラム表示
- **TranslationCaption**: Intent結果・信頼度表示

## 関連ドキュメント

- [データフロー全体図](../architecture/data-flow.md)
- [粒合成システム](./speech-synthesis.md)
- [page.tsx 詳細](../components/page.md)
