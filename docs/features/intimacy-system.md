# 親密度学習システム

## 概要

ユーザーとの会話を記録し、親密度スコアを計算することで、音声パラメータを自動調整するシステムです。すべてのデータは localStorage に保存され、外部送信されません。

**場所**: `src/lib/pandaLearning.ts`

## コアコンセプト

### 親密度（Intimacy）

ユーザーとの関係性を 0-100 のスコアで数値化し、以下の要素から計算：

1. **会話回数** - 何回話したか（最大50点）
2. **累計時間** - 合計何分話したか（最大25点）
3. **来訪頻度** - 何日間訪問したか（最大15点）
4. **継続性** - 連続何日訪問したか（最大10点）

### 学習データの保存

```
localStorage['panda_memory'] = {
  totalConversations: 35,
  intimacyLevel: 67,
  preferredResponseStyle: 'playful',
  specialUnlocks: ['chatty_friend', 'close_buddy'],
  ...
}
```

## データ構造

### PandaMemory 型

```typescript
interface PandaMemory {
  // 基本統計
  totalConversations: number      // 総会話数
  uniqueDays: number              // ユニーク訪問日数
  firstMeeting: Date | null       // 初回会話日時
  lastSeen: Date | null           // 最終会話日時

  // 会話パターン
  favoriteQuestions: Array<{      // よく使う質問（上位10件）
    question: string
    count: number
  }>
  conversationHistory: ConversationData[]  // 会話履歴（最新100件）
  totalSessionTime: number        // 累計会話時間（秒）

  // 親密度指標
  intimacyLevel: number           // 0-100の親密度スコア
  longestSession: number          // 最長会話時間（秒）
  consecutiveDays: number         // 連続来訪日数

  // 学習結果
  preferredResponseStyle: 'gentle' | 'energetic' | 'playful' | 'mixed'
  specialUnlocks: string[]        // 解放された特別な称号
}
```

### ConversationData 型

```typescript
interface ConversationData {
  timestamp: Date                 // 会話日時
  userInput: string               // ユーザー入力
  pandaResponse: {                // パンダの返答
    id: number
    translation: string
  }
  sessionDuration: number         // セッション時間（秒）
}
```

## 主要関数

### 1. recordConversation()

新しい会話を記録し、すべての統計を更新

```typescript
function recordConversation(
  memory: PandaMemory,
  userInput: string,
  pandaResponse: { id: number; translation: string },
  sessionDuration: number = 5
): PandaMemory
```

#### 処理フロー

```typescript
// 1. 初回会話の記録
if (!memory.firstMeeting) {
  memory.firstMeeting = now
}

// 2. 新しい会話データを作成
const newConversation: ConversationData = {
  timestamp: now,
  userInput,
  pandaResponse,
  sessionDuration
}

// 3. 会話履歴を更新（最新100件のみ保持）
memory.conversationHistory.unshift(newConversation)
if (memory.conversationHistory.length > 100) {
  memory.conversationHistory = memory.conversationHistory.slice(0, 100)
}

// 4. 基本統計の更新
memory.totalConversations++
memory.totalSessionTime += sessionDuration
memory.lastSeen = now

// 5. 最長セッション時間の更新
if (sessionDuration > memory.longestSession) {
  memory.longestSession = sessionDuration
}

// 6. ユニーク日数の計算
const uniqueDaysSet = new Set(
  memory.conversationHistory.map(conv => conv.timestamp.toDateString())
)
memory.uniqueDays = uniqueDaysSet.size

// 7. 連続来訪日数の計算
memory.consecutiveDays = calculateConsecutiveDays(memory.conversationHistory)

// 8. よく使う質問の更新
updateFavoriteQuestions(memory, userInput)

// 9. 親密度の再計算
memory.intimacyLevel = calculateIntimacyLevel(memory)

// 10. 好みのレスポンススタイル学習
memory.preferredResponseStyle = learnPreferredStyle(memory)

// 11. 特別解放の確認
checkSpecialUnlocks(memory)

return memory
```

#### 使用例（page.tsx:305-333）

```typescript
const previousIntimacy = pandaMemory.intimacyLevel
const previousUnlocks = [...pandaMemory.specialUnlocks]

const updatedMemory = recordConversation(
  pandaMemory,
  input,
  { id: reply.id, translation: reply.translation },
  sessionDuration
)

setPandaMemory(updatedMemory)
savePandaMemory(updatedMemory)

// 親密度が上がったらアニメーション
if (updatedMemory.intimacyLevel > previousIntimacy) {
  setIntimacyAnimating(true)
}

// 新しい解放があった場合の通知
const newUnlocksList = updatedMemory.specialUnlocks.filter(
  unlock => !previousUnlocks.includes(unlock)
)
if (newUnlocksList.length > 0) {
  setShowMilestone(true)
}
```

### 2. calculateIntimacyLevel()

親密度スコアを計算（0-100）

```typescript
function calculateIntimacyLevel(memory: PandaMemory): number
```

#### 計算式

```typescript
// 1. 会話回数スコア（最大50点）
const conversationScore = Math.min(memory.totalConversations * 2, 50)
// 例: 25回会話 → 50点（上限）

// 2. 累計時間スコア（最大25点）
const timeScore = Math.min(memory.totalSessionTime / 60, 25)
// 例: 1500秒（25分） → 25点（上限）

// 3. 来訪頻度スコア（最大15点）
const regularityScore = Math.min(memory.uniqueDays * 3, 15)
// 例: 5日訪問 → 15点（上限）

// 4. 継続性スコア（最大10点）
const loyaltyScore = Math.min(memory.consecutiveDays * 2, 10)
// 例: 5日連続 → 10点（上限）

// 合計して100点満点
const totalScore = conversationScore + timeScore + regularityScore + loyaltyScore
return Math.min(Math.round(totalScore), 100)
```

#### スコア例

| 状況 | 会話数 | 時間 | 日数 | 連続 | 合計 |
|-----|-------|-----|-----|-----|------|
| 新規 | 0点 | 0点 | 0点 | 0点 | **0点** |
| 初心者 | 10点 (5回) | 5点 (5分) | 6点 (2日) | 2点 (1日) | **23点** |
| 常連 | 40点 (20回) | 15点 (15分) | 12点 (4日) | 6点 (3日) | **73点** |
| 親友 | 50点 (25回+) | 25点 (25分+) | 15点 (5日+) | 10点 (5日+) | **100点** |

### 3. getIntimacyAdjustedParams()

親密度に基づいて音声パラメータを調整

```typescript
function getIntimacyAdjustedParams(
  baseParams: SpeechParams,
  intimacyLevel: number,
  preferredStyle: string = 'mixed'
): SpeechParams
```

#### 調整ロジック

```typescript
// 1. 親密度を0-1に正規化
const intimacy = intimacyLevel / 100

// 2. 表現豊かさを計算（0.5-1.0）
const expressiveness = 0.5 + (intimacy * 0.5)

// 3. 基本パラメータに適用
const adjustedParams: SpeechParams = {
  ...baseParams,
  grainCount: Math.floor((baseParams.grainCount || 3) * expressiveness),
  pitchVariation: (baseParams.pitchVariation || 2) * expressiveness,
  useReverb: intimacy > 0.3  // 30%以上でリバーブ有効
}
```

#### preferredStyle による追加調整

**gentle（穏やか）**:
```typescript
pitchVariation: pitchVariation * 0.7  // ピッチ変化を抑える
speedVariation: [0.9, 1.1]            // 落ち着いた速度
```

**energetic（元気）**:
```typescript
grainCount: grainCount + 1            // 粒数を増やす
speedVariation: [1.0, 1.2]            // 速めの速度
```

**playful（遊び好き）**:
```typescript
pitchVariation: pitchVariation * 1.3  // ピッチ変化を増幅
grainInterval: [0.04, 0.12]           // 短い間隔でリズミカル
```

#### 使用例（page.tsx:217-221）

```typescript
const baseSpeechParams = createVariedSpeechParams(intent)

const intimacyAdjustedParams = getIntimacyAdjustedParams(
  baseSpeechParams,
  pandaMemory.intimacyLevel,
  pandaMemory.preferredResponseStyle
)

// 親密度が高いほど表現豊かな音声になる
```

### 4. learnPreferredStyle()

ユーザーの好みのレスポンススタイルを学習

```typescript
function learnPreferredStyle(memory: PandaMemory):
  'gentle' | 'energetic' | 'playful' | 'mixed'
```

#### 学習ロジック

```typescript
// 1. 最近20件の会話を分析
const recentHistory = memory.conversationHistory.slice(0, 20)

// 2. キーワードパターン定義
const keywordPatterns = {
  gentle: ['こんにちは', 'ありがとう', 'お疲れ', '大丈夫'],
  energetic: ['頑張って', '元気', '楽しい', 'すごい'],
  playful: ['あそぼ', '面白い', '笑う', 'わーい']
}

// 3. 各スタイルのスコア計算
const scores = { gentle: 0, energetic: 0, playful: 0 }

recentHistory.forEach(conv => {
  const input = conv.userInput.toLowerCase()
  // キーワードマッチでスコア加算
})

// 4. 最高スコアのスタイルを返す（3点以上の場合）
return maxStyle.score > 3 ? maxStyle.style : 'mixed'
```

#### 学習例

```
会話履歴:
- "あそぼ！" → playful +1
- "楽しいね" → energetic +1
- "あそぼー" → playful +1
- "わーい" → playful +1
- "面白い" → playful +1

結果: playful (4点) → preferredResponseStyle = 'playful'
```

### 5. checkSpecialUnlocks()

特別な称号の解放判定

```typescript
function checkSpecialUnlocks(memory: PandaMemory): void
```

#### マイルストーン条件

| ID | 称号 | 条件 |
|----|------|------|
| `chatty_friend` | おしゃべり好き | 総会話数 ≥ 10回 |
| `close_buddy` | 親密な友達 | 親密度 ≥ 50 |
| `regular_visitor` | 常連さん | 連続来訪 ≥ 3日 |
| `weekly_friend` | 1週間の友 | ユニーク日数 ≥ 7日 |

#### 実装

```typescript
const unlocks = []

if (memory.totalConversations >= 10 &&
    !memory.specialUnlocks.includes('chatty_friend')) {
  unlocks.push('chatty_friend')
}

if (memory.intimacyLevel >= 50 &&
    !memory.specialUnlocks.includes('close_buddy')) {
  unlocks.push('close_buddy')
}

// ...

memory.specialUnlocks.push(...unlocks)
```

### 6. ヘルパー関数

#### calculateConsecutiveDays()

連続来訪日数を計算

```typescript
function calculateConsecutiveDays(history: ConversationData[]): number
```

**ロジック**:
1. 会話履歴から日付を抽出し、ユニーク化
2. 新しい順にソート
3. 1日以内の間隔なら連続とカウント
4. 間が空いたら終了

```typescript
const uniqueDays = ['2025-01-16', '2025-01-15', '2025-01-14', '2025-01-12']
// → 連続日数: 3日（16, 15, 14）
```

#### updateFavoriteQuestions()

よく使う質問を更新

```typescript
function updateFavoriteQuestions(memory: PandaMemory, userInput: string): void
```

**ロジック**:
1. 同じ質問があればカウント +1
2. なければ新規追加
3. 頻度順にソート
4. 上位10件のみ保持

```typescript
// 例:
favoriteQuestions: [
  { question: "こんにちは", count: 15 },
  { question: "あそぼ", count: 8 },
  { question: "お腹すいた", count: 5 },
  ...
]
```

## localStorage 管理

### loadPandaMemory()

```typescript
function loadPandaMemory(): PandaMemory
```

**処理**:
1. localStorage から `panda_memory` を取得
2. JSON パース
3. Date オブジェクトを復元
4. エラー時は初期値を返す

**SSR 対応**:
```typescript
if (typeof window === 'undefined') {
  return createInitialMemory()
}
```

### savePandaMemory()

```typescript
function savePandaMemory(memory: PandaMemory): void
```

**処理**:
1. JSON シリアライズ
2. localStorage に保存
3. エラー時はコンソールログのみ

## UI 連携

### 親密度メッセージ（getIntimacyMessage）

```typescript
function getIntimacyMessage(intimacyLevel: number): string
```

| レベル | メッセージ |
|-------|-----------|
| 80+ | "もうとっても仲良しだね！🥰" |
| 60-79 | "すっかり友達になったね！😊" |
| 40-59 | "だいぶ慣れてきたよ～♪" |
| 20-39 | "少しずつ仲良しになってるね！" |
| 5-19 | "だんだん覚えてきたよ！" |
| 0-4 | "初めまして！よろしくね🐾" |

### 親密度レベル名（getIntimacyLevelName）

```typescript
function getIntimacyLevelName(intimacyLevel: number): string
```

| レベル | 名称 |
|-------|------|
| 80+ | "親友" |
| 60-79 | "友達" |
| 40-59 | "知り合い" |
| 20-39 | "顔見知り" |
| 5-19 | "新顔" |
| 0-4 | "はじめまして" |

## 使用例（page.tsx）

### 初期化（SSR 対応）

```typescript
// page.tsx:44-63
const [pandaMemory, setPandaMemory] = useState<PandaMemory>(() => {
  // SSR時は常に初期値を返す
  if (typeof window === 'undefined') {
    return {
      totalConversations: 0,
      intimacyLevel: 0,
      // ...
    }
  }
  return loadPandaMemory()
})

// クライアント側で実際のデータを読み込み
useEffect(() => {
  const actualMemory = loadPandaMemory()
  setPandaMemory(actualMemory)
}, [])
```

### 会話記録（page.tsx:298-333）

```typescript
// セッション時間計算
const sessionDuration = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)

// 会話記録
const updatedMemory = recordConversation(
  pandaMemory,
  input,
  { id: reply.id, translation: reply.translation },
  Math.max(sessionDuration, 5)  // 最低5秒
)

// State更新 + localStorage保存
setPandaMemory(updatedMemory)
savePandaMemory(updatedMemory)

// アニメーション・通知
if (updatedMemory.intimacyLevel > previousIntimacy) {
  setIntimacyAnimating(true)
}
```

### StatusPanel での表示

```typescript
// StatusPanel.tsx:100-111
<IntimacyGauge
  intimacyLevel={pandaMemory.intimacyLevel}
  totalConversations={pandaMemory.totalConversations}
  relationshipName={getIntimacyLevelName(pandaMemory.intimacyLevel)}
  message={getIntimacyMessage(pandaMemory.intimacyLevel)}
  isAnimating={intimacyAnimating}
/>

// 学習状況表示
<div>スタイル: {pandaMemory.preferredResponseStyle}</div>
<div>総会話: {pandaMemory.totalConversations}回</div>
<div>人気: {pandaMemory.favoriteQuestions[0]?.question}</div>
```

## プライバシー配慮

### データの保存場所
- すべて localStorage（ブラウザローカル）
- 外部サーバーへの送信なし

### データのリセット
```javascript
// ブラウザの開発者ツールで実行
localStorage.removeItem('panda_memory')
// または
localStorage.clear()
```

### データサイズ
- 会話履歴: 最新100件のみ
- よく使う質問: 上位10件のみ
- 推定サイズ: 10-50KB

## パフォーマンス

### 計算コスト
- recordConversation(): O(n) (n = 会話履歴件数, 最大100)
- calculateIntimacyLevel(): O(1)
- learnPreferredStyle(): O(n) (n = 最近20件)

### localStorage アクセス
- 読み込み: ページ初回のみ
- 保存: 会話ごと（非同期処理なので影響小）

## デバッグ

### メモリ確認

```javascript
// ブラウザコンソールで実行
const memory = JSON.parse(localStorage.getItem('panda_memory'))
console.log('Intimacy:', memory.intimacyLevel)
console.log('Conversations:', memory.totalConversations)
console.log('Style:', memory.preferredResponseStyle)
console.log('Unlocks:', memory.specialUnlocks)
```

### 手動設定

```javascript
const memory = JSON.parse(localStorage.getItem('panda_memory'))
memory.intimacyLevel = 100
memory.specialUnlocks = ['chatty_friend', 'close_buddy', 'regular_visitor', 'weekly_friend']
localStorage.setItem('panda_memory', JSON.stringify(memory))
```

## 関連ドキュメント

- [データフロー全体図](../architecture/data-flow.md)
- [粒合成システム](./speech-synthesis.md)
- [page.tsx 詳細](../components/page.md)
