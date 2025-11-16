# 粒合成風音声再生システム

## 概要

Web Audio API を使用して、MP3音源を「粒」に分けてランダム再生することで、毎回少し違う鳴き方を生成するシステムです。

**場所**: `src/lib/pandaSpeech.ts`

## コアコンセプト

### 粒合成（Granular Synthesis）とは

音声ファイルを短い時間単位（粒 = Grain）に分割し、それらを組み合わせて新しい音を生成する手法。

```
元の音声: [━━━━━━━━━━━━━━━━━━]

粒合成後:  [━━] ... [━] ..... [━━━] .. [━]
           粒1  間隔  粒2  間隔   粒3  間隔 粒4
```

### このシステムの特徴

1. **毎回違う音**: 粒の開始位置・長さ・間隔がランダム
2. **ピッチ変化**: ±3半音の範囲で変化
3. **速度変化**: 0.85〜1.15倍の範囲で変化
4. **簡易リバーブ**: 空間的な広がりを追加
5. **Intent 連動**: あいさつ・はらぺこ・あそぼで特性が変化

## システム構成

```
MP3ファイル読み込み
  ↓
AudioBuffer デコード
  ↓
粒合成パラメータ生成
  ├─ 粒数: 3-8個
  ├─ 各粒の開始時刻: ランダム間隔
  ├─ 各粒の長さ: 0.4-0.9秒
  ├─ ピッチ: ±3半音
  └─ 速度: 0.85-1.15倍
  ↓
各粒を順次再生
  ↓
AnalyserBridge 経由で解析
  ↓
Convolver でリバーブ追加
  ↓
AudioContext.destination へ出力
```

## 主要パラメータ

### SpeechParams 型定義

```typescript
interface SpeechParams {
  grainCount?: number            // 粒数: 3-8
  pitchVariation?: number        // ピッチ変化: ±3半音
  speedVariation?: [number, number]  // 再生速度: [min, max]
  grainDuration?: [number, number]   // 各粒の長さ: [min, max]秒
  grainInterval?: [number, number]   // 粒間隔: [min, max]秒
  useReverb?: boolean            // 簡易リバーブ使用
}
```

### デフォルト値（DEFAULT_PARAMS）

```typescript
{
  grainCount: 3,
  pitchVariation: 3,
  speedVariation: [0.85, 1.15],
  grainDuration: [0.25, 0.6],
  grainInterval: [0.3, 0.8],  // 300-800ms
  useReverb: true
}
```

## 主要関数

### 1. speakLikePandaWithAnalysis()

解析機能付きの粒合成再生

```typescript
async function speakLikePandaWithAnalysis(
  context: AudioContext,
  audioUrl: string,
  params: SpeechParams = {},
  analyserBridge?: AnalyserBridge
): Promise<SpeechAnalysisResult>
```

#### 処理フロー

```typescript
// 1. AudioBuffer読み込み
const audioBuffer = await loadAudioBuffer(context, audioUrl)

// 2. 粒数決定（ランダム性追加）
const grainCount = Math.floor(randomInRange(3, 8))

// 3. リバーブ準備
const convolver = context.createConvolver()
convolver.buffer = createImpulseResponse(context)

// 4. 各粒の開始時刻を計算
const grainStartTimes = []
let currentTime = 0
for (let i = 0; i < grainCount; i++) {
  grainStartTimes.push(currentTime)
  const interval = randomInRange(0.3, 0.8)  // 300-800ms間隔
  currentTime += interval
}

// 5. 各粒の長さを決定
const grainDurations = grainStartTimes.map(() =>
  randomInRange(0.25, 0.6)  // 250-600ms
)

// 6. 総発話時間を計算
const actualDuration = grainStartTimes[grainCount - 1] + grainDurations[grainCount - 1]

// 7. GrainTimelineを構築（解析用）
const grainTimeline: GrainTimeline[] = grainStartTimes.map((startTime, i) => ({
  grainIndex: i,
  startTime: startTime * 1000,      // ms
  duration: grainDurations[i] * 1000 // ms
}))

// 8. 各粒を順次再生
grainStartTimes.forEach((startTime, i) => {
  setTimeout(() => {
    createAndPlayGrainWithAnalysis(...)
  }, startTime * 1000)
})

// 9. 結果を返す
return { actualDuration, grainTimeline }
```

#### 戻り値: SpeechAnalysisResult

```typescript
{
  actualDuration: 2.5,  // 秒（実際の発話時間）
  grainTimeline: [
    { grainIndex: 0, startTime: 0, duration: 450 },
    { grainIndex: 1, startTime: 750, duration: 380 },
    { grainIndex: 2, startTime: 1450, duration: 520 },
    ...
  ]
}
```

### 2. createAndPlayGrainWithAnalysis()

個別の粒を作成・再生

```typescript
function createAndPlayGrainWithAnalysis(
  context: AudioContext,
  audioBuffer: AudioBuffer,
  bufferDuration: number,
  config: Required<SpeechParams>,
  convolver: ConvolverNode | null,
  grainLength: number,
  analyserBridge?: AnalyserBridge
): void
```

#### 処理内容

```typescript
// 1. BufferSource作成
const source = context.createBufferSource()
source.buffer = audioBuffer

// 2. ランダムな開始位置を決定
const maxOffset = bufferDuration - grainLength
const startTime = randomInRange(0, maxOffset)

// 3. ピッチ・速度のランダム変化
const pitchSemitones = randomInRange(-3, 3)
const basePlaybackRate = randomInRange(0.85, 1.15)
source.playbackRate.value = basePlaybackRate * semitoneToRate(pitchSemitones)

// 4. フェード用のGainNode
const gainNode = context.createGain()
const fadeTime = 0.02  // 20ms

// フェードイン・アウト
gainNode.gain.setValueAtTime(0, currentTime)
gainNode.gain.linearRampToValueAtTime(0.7, currentTime + fadeTime)
gainNode.gain.setValueAtTime(0.7, currentTime + grainLength - fadeTime)
gainNode.gain.linearRampToValueAtTime(0, currentTime + grainLength)

// 5. オーディオグラフ接続
source → gainNode → analyser → [dry/wet] → destination
                                     ↓
                                  convolver (wet)
```

#### オーディオグラフ（解析あり + リバーブあり）

```
source (AudioBufferSourceNode)
  ↓
gainNode (フェード処理)
  ↓
analyserBridge.analyser (解析)
  ├─ dryGain (70%) → destination
  └─ wetGain (30%) → convolver → destination
```

### 3. createVariedSpeechParams()

Intent に応じたパラメータ生成

```typescript
function createVariedSpeechParams(
  intent: 'greeting' | 'hungry' | 'playful' | 'random'
): SpeechParams
```

#### Intent 別パラメータ

##### greeting（あいさつ）
```typescript
{
  grainCount: 3-8,
  pitchVariation: 1-2,          // 穏やかなピッチ
  speedVariation: [0.9, 1.1],   // 落ち着いた速度
  grainDuration: [0.5, 0.8],    // 長めの粒
  grainInterval: [0.4, 0.7],    // ゆったり間隔
  useReverb: 70%確率
}
```

**特徴**: バランス良く、落ち着いた印象

##### hungry（はらぺこ）
```typescript
{
  grainCount: 3-8,
  pitchVariation: 0.5-1.5,      // 低めのピッチ
  speedVariation: [0.85, 1.0],  // やや遅め
  grainDuration: [0.6, 0.9],    // 最も長い粒
  grainInterval: [0.5, 0.9],    // 長い間隔
  useReverb: 70%確率
}
```

**特徴**: ゆっくり、低音、切ない感じ

##### playful（あそぼ）
```typescript
{
  grainCount: 3-8,
  pitchVariation: 2-3,          // 大きなピッチ変化
  speedVariation: [1.0, 1.15],  // 速め
  grainDuration: [0.4, 0.6],    // 中間の粒
  grainInterval: [0.2, 0.5],    // 短い間隔
  useReverb: 70%確率
}
```

**特徴**: 活発、高音、テンポ速い

##### random（ランダム）
```typescript
{
  grainCount: 3-8,
  pitchVariation: 1-3,
  speedVariation: [0.85-0.95, 1.05-1.15],
  grainDuration: [0.4-0.5, 0.6-0.9],
  grainInterval: [0.3, 0.8],
  useReverb: 70%確率
}
```

**特徴**: 全要素がランダム

## ユーティリティ関数

### semitoneToRate()

半音をplaybackRateに変換

```typescript
function semitoneToRate(semitones: number): number {
  return Math.pow(2, semitones / 12)
}

// 例:
semitoneToRate(12)  // → 2.0 (1オクターブ上)
semitoneToRate(-12) // → 0.5 (1オクターブ下)
semitoneToRate(3)   // → 1.189 (3半音上)
```

### randomInRange()

範囲内のランダム値

```typescript
function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}
```

### createImpulseResponse()

簡易リバーブ用のインパルス応答生成

```typescript
function createImpulseResponse(
  context: AudioContext,
  duration: number = 0.5
): AudioBuffer
```

**処理内容**:
1. 0.5秒分のランダムノイズを生成
2. 時間経過とともに減衰（`decay = (1 - i/length)^2`）
3. 振幅を0.3倍に抑制（リバーブ量調整）
4. ステレオ（2チャンネル）で生成

## 使用例

### 基本的な使い方（page.tsx）

```typescript
// 1. AudioContext初期化
audioContextRef.current = await initializeAudioContext()

// 2. AnalyserBridge作成
const analyser = createAnalyser(audioContextRef.current)
setAnalyserBridge(analyser)

// 3. Intent に応じたパラメータ生成
const intent = 'playful'
const baseSpeechParams = createVariedSpeechParams(intent)

// 4. 親密度調整（オプション）
const intimacyAdjustedParams = getIntimacyAdjustedParams(
  baseSpeechParams,
  pandaMemory.intimacyLevel,
  pandaMemory.preferredResponseStyle
)

// 5. 音声再生 + 解析
const speechResult = await speakLikePandaWithAnalysis(
  audioContextRef.current,
  '/sounds/red_panda_voice2.mp3',
  intimacyAdjustedParams,
  analyser
)

// 6. 結果を使用
console.log('Duration:', speechResult.actualDuration)
console.log('Grain timeline:', speechResult.grainTimeline)
```

### 従来の方式（解析なし）

```typescript
const duration = await speakLikePanda(
  audioContextRef.current,
  '/sounds/red_panda_voice1.mp3',
  { grainCount: 5, pitchVariation: 2 }
)
```

## 音声ファイル要件

### 配置場所
```
public/sounds/
├── red_panda_voice1.mp3  # はらぺこ系
├── red_panda_voice2.mp3  # あそぼ系
└── red_panda_voice3.mp3  # あいさつ系
```

### 推奨仕様
- **形式**: MP3（モバイル対応）
- **サンプルレート**: 44.1kHz
- **ビットレート**: 128kbps以上
- **ファイルサイズ**: 5MB以下（推奨）
- **長さ**: 2-5秒（粒合成に適した長さ）

## パフォーマンス考慮

### メモリ使用量
```
AudioBuffer (44.1kHz, 3秒, ステレオ):
  44100 * 3 * 2 * 4 bytes ≈ 1MB

3ファイル → 約3MB
```

### CPU負荷
- **デコード**: 初回のみ（非同期）
- **粒生成**: 各粒ごとに setTimeout（軽量）
- **リバーブ**: Convolver（GPU加速される場合あり）

### 同時再生数
- 粒数3-8個が順次再生
- 重複する粒: 最大2-3個程度
- モバイルでも問題なし

## モバイル対応

### iOS Safari
```typescript
// page.tsx:190-192
if (!audioContextRef.current) {
  audioContextRef.current = await initializeAudioContext()
}

// pandaSpeech.ts:157-159
if (context.state === 'suspended') {
  context.resume()  // ユーザー操作後に自動再開
}
```

### Android Chrome
- Web Audio API 完全対応
- 特別な処理不要

## エラーハンドリング

### ファイル読み込み失敗
```typescript
// pandaSpeech.ts:56-65
try {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  return await context.decodeAudioData(arrayBuffer)
} catch (error) {
  console.error('Audio loading failed:', error)
  throw error
}
```

### 粒生成失敗
```typescript
// pandaSpeech.ts:224-235
try {
  source.start(currentTime, startTime)
  source.stop(currentTime + grainLength)
} catch (error) {
  console.error('Grain creation failed:', error)
  // 次の粒は影響を受けない（個別にtry-catch）
}
```

## デバッグ

### GrainTimeline の可視化

```typescript
grainTimeline.forEach(grain => {
  console.log(`Grain ${grain.grainIndex}: ${grain.startTime}ms ~ ${grain.startTime + grain.duration}ms`)
})

// 出力例:
// Grain 0: 0ms ~ 450ms
// Grain 1: 750ms ~ 1130ms
// Grain 2: 1450ms ~ 1970ms
```

### 音声パラメータの確認

```typescript
console.log('Speech params:', {
  grainCount,
  actualDuration,
  grainStartTimes,
  grainDurations
})
```

## カスタマイズ例

### 粒数を増やして密度アップ
```typescript
const params = {
  grainCount: 10,
  grainInterval: [0.1, 0.3]  // 短い間隔
}
```

### ピッチ変化を大きくして不思議な音に
```typescript
const params = {
  pitchVariation: 7,  // ±7半音
  speedVariation: [0.5, 1.5]
}
```

### リバーブを強化
```typescript
// pandaSpeech.ts:40-53 を修正
const impulse = context.createBuffer(2, length, context.sampleRate)
// ...
channelData[i] = (Math.random() * 2 - 1) * decay * 0.6  // 0.3 → 0.6
```

## 関連ドキュメント

- [データフロー全体図](../architecture/data-flow.md)
- [音声解析システム](./audio-analysis.md)
- [親密度システム](./intimacy-system.md)
- [page.tsx 詳細](../components/page.md)
