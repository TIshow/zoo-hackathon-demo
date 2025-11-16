# page.tsx 詳細解説

## 概要

アプリケーションのメインページコンポーネント。会話管理、音声解析、親密度学習を統合し、すべての機能を orchestrate します。

**場所**: `src/app/page.tsx`

## 責務

1. **会話管理** - ユーザー入力受付、パンダ返答生成、履歴管理
2. **音声合成** - 粒合成音声の再生と制御
3. **音声解析** - リアルタイムスペクトラム解析と Intent 分類
4. **親密度学習** - 会話データの記録と親密度計算
5. **UI 制御** - 各種コンポーネントの状態管理

## State 管理

### 基本 State

```typescript
const [userInput, setUserInput] = useState('')           // 入力テキスト
const [currentReply, setCurrentReply] = useState<PandaReply | null>(null)
const [isSpeaking, setIsSpeaking] = useState(false)      // 発話中フラグ
const [isThinking, setIsThinking] = useState(false)      // 考え中フラグ
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])  // 会話履歴
```

### 親密度 State

```typescript
const [pandaMemory, setPandaMemory] = useState<PandaMemory>(() => {
  // SSR対応: サーバー側では初期値、クライアント側で実データ読み込み
  if (typeof window === 'undefined') {
    return { totalConversations: 0, intimacyLevel: 0, ... }
  }
  return loadPandaMemory()
})

const [intimacyAnimating, setIntimacyAnimating] = useState(false)
const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
const [newUnlocks, setNewUnlocks] = useState<string[]>([])
const [showMilestone, setShowMilestone] = useState(false)
const [showShareCard, setShowShareCard] = useState(false)
const [isClientMounted, setIsClientMounted] = useState(false)
```

### 音声解析 State

```typescript
const [analyserBridge, setAnalyserBridge] = useState<AnalyserBridge | null>(null)
const [isAnalysisEnabled, setIsAnalysisEnabled] = useState(true)
const [isAnalyzing, setIsAnalyzing] = useState(false)

// 一時データ（解析中のみ）
const [currentIntentResult, setCurrentIntentResult] = useState<IntentResult | null>(null)
const [currentPandaSound, setCurrentPandaSound] = useState('')
const [currentTranslation, setCurrentTranslation] = useState('')
const [currentGrainTimeline, setCurrentGrainTimeline] = useState<GrainTimeline[]>([])

// 永続データ（音声終了後も保持）
const [latestAnalysisResult, setLatestAnalysisResult] = useState<{
  intentResult: IntentResult | null
  pandaSound: string
  translation: string
  grainTimeline: GrainTimeline[]
} | null>(null)
```

### Ref 管理

```typescript
const autoSpeakTimer = useRef<NodeJS.Timeout | null>(null)
const audioContextRef = useRef<AudioContext | null>(null)

// 音声解析用
const featureAggregatorRef = useRef<FeatureAggregator>(new FeatureAggregator())
const intentClassifierRef = useRef<IntentClassifier>(new IntentClassifier())
const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)
```

## 主要関数

### performSpeech()

音声合成・解析・会話記録を統合的に実行するメイン関数

```typescript
const performSpeech = useCallback(async (
  input: string,
  isUserInput: boolean = true
) => {
  // ...
}, [isSpeaking, pandaMemory, sessionStartTime, createSafeAnalysisResult])
```

#### 処理フロー詳細

```typescript
// 【1. 前処理】
if (isSpeaking) return  // 発話中は処理しない

// 前回の解析結果をクリア
if (isAnalysisEnabled) {
  setCurrentIntentResult(null)
  setCurrentPandaSound('')
  setCurrentTranslation('')
  setCurrentGrainTimeline([])
}

// 【2. ユーザーメッセージを履歴に追加】
if (isUserInput) {
  setChatMessages(prev => [...prev, {
    id: userMessageId,
    type: 'user',
    content: input,
    timestamp: new Date()
  }])
}

// 【3. 考え中演出】
setIsThinking(true)
await new Promise(resolve => setTimeout(resolve, 250))
setIsThinking(false)

// 【4. 返答選択】
setIsSpeaking(true)
const reply = selectPandaReply(input)

// 【5. AudioContext初期化】
if (!audioContextRef.current) {
  audioContextRef.current = await initializeAudioContext()
}

// 【6. AnalyserBridge作成（解析有効時のみ）】
let currentAnalyserBridge = analyserBridge
if (isAnalysisEnabled && !currentAnalyserBridge) {
  try {
    const analyser = createAnalyser(audioContextRef.current)
    setAnalyserBridge(analyser)
    currentAnalyserBridge = analyser
  } catch (error) {
    console.error('Failed to create analyser:', error)
  }
}

// 【7. Intentに応じたパラメータ生成】
let intent: 'greeting' | 'hungry' | 'playful' | 'random' = 'random'
if (reply.id === 1) intent = 'hungry'
else if (reply.id === 2) intent = 'playful'
else if (reply.id === 3) intent = 'greeting'

const baseSpeechParams = createVariedSpeechParams(intent)

// 【8. 親密度に基づくパラメータ調整】
const intimacyAdjustedParams = getIntimacyAdjustedParams(
  baseSpeechParams,
  pandaMemory.intimacyLevel,
  pandaMemory.preferredResponseStyle
)

// 【9. 音声合成 + 解析】
let speechResult: SpeechAnalysisResult

if (isAnalysisEnabled && currentAnalyserBridge) {
  // 解析機能付き音声再生
  setIsAnalyzing(true)
  featureAggregatorRef.current.clear()

  // 50ms毎に特徴量サンプリング
  analysisIntervalRef.current = setInterval(() => {
    if (currentAnalyserBridge) {
      const frequencyData = currentAnalyserBridge.getFrequencyFrame()
      const timeData = currentAnalyserBridge.getTimeFrame()
      const features = extractFeatures(frequencyData, timeData)
      featureAggregatorRef.current.addSample(features)
    }
  }, 50)

  speechResult = await speakLikePandaWithAnalysis(
    audioContextRef.current,
    reply.src,
    intimacyAdjustedParams,
    currentAnalyserBridge
  )
} else {
  // 従来の方式
  const duration = await speakLikePanda(
    audioContextRef.current,
    reply.src,
    intimacyAdjustedParams
  )
  speechResult = {
    actualDuration: duration,
    grainTimeline: []
  }

  // 解析機能が無効でも基本的な結果を生成
  if (isAnalysisEnabled) {
    const { intentResult, pandaSound, translation } = createSafeAnalysisResult('basic')
    setLatestAnalysisResult({ intentResult, pandaSound, translation, grainTimeline: [] })
  }
}

// 【10. 翻訳表示】
setCurrentReply(reply)
if (isUserInput) {
  setUserInput('')
}

// 【11. 親密度システム更新】
if (isUserInput) {
  const startTime = sessionStartTime || new Date()
  const sessionDuration = Math.floor((Date.now() - startTime.getTime()) / 1000)
  const previousIntimacy = pandaMemory.intimacyLevel
  const previousUnlocks = [...pandaMemory.specialUnlocks]

  const updatedMemory = recordConversation(
    pandaMemory,
    input,
    { id: reply.id, translation: reply.translation },
    Math.max(sessionDuration, 5)
  )

  setPandaMemory(updatedMemory)
  savePandaMemory(updatedMemory)

  // 親密度上昇アニメーション
  if (updatedMemory.intimacyLevel > previousIntimacy) {
    setIntimacyAnimating(true)
    setTimeout(() => setIntimacyAnimating(false), 2000)
  }

  // マイルストーン通知
  const newUnlocksList = updatedMemory.specialUnlocks.filter(
    unlock => !previousUnlocks.includes(unlock)
  )
  if (newUnlocksList.length > 0) {
    setNewUnlocks(newUnlocksList)
    setShowMilestone(true)
  }

  setSessionStartTime(new Date())
}

// 【12. 解析結果の処理】
if (isAnalysisEnabled) {
  // サンプリング停止
  if (analysisIntervalRef.current) {
    clearInterval(analysisIntervalRef.current)
    analysisIntervalRef.current = null
  }

  // 特徴量集計と分類
  const aggregate = featureAggregatorRef.current.getAggregate()

  if (aggregate.sampleCount > 0) {
    const intentResult = intentClassifierRef.current.classify(aggregate)
    const pandaSound = intentClassifierRef.current.getRandomPandaSound(intentResult.intent)
    const translation = intentClassifierRef.current.getRandomTranslation(intentResult.intent)

    // 現在の解析結果を設定
    setCurrentIntentResult(intentResult)
    setCurrentPandaSound(pandaSound)
    setCurrentTranslation(translation)
    setCurrentGrainTimeline(speechResult.grainTimeline)

    // 解析結果を永続化
    setLatestAnalysisResult({
      intentResult,
      pandaSound,
      translation,
      grainTimeline: speechResult.grainTimeline
    })
  } else {
    // フォールバック結果を生成
    const { intentResult, pandaSound, translation } = createSafeAnalysisResult('fallback')
    setLatestAnalysisResult({ intentResult, pandaSound, translation, grainTimeline: [] })
  }

  // 一定時間後に解析状態を終了
  setTimeout(() => {
    setIsAnalyzing(false)
  }, speechResult.actualDuration * 1000 + 500)
}

// 【13. 音声終了処理】
const finalDuration = speechResult.actualDuration + 0.5

setTimeout(() => {
  setIsSpeaking(false)

  // パンダメッセージを会話履歴に追加
  if (isUserInput) {
    setChatMessages(prev => [...prev, {
      id: pandaMessageId,
      type: 'panda',
      content: reply.src,
      timestamp: new Date(),
      reply,
      analysisData: isAnalysisEnabled && latestAnalysisResult ? {
        intentResult: latestAnalysisResult.intentResult,
        pandaSound: latestAnalysisResult.pandaSound,
        translation: latestAnalysisResult.translation,
        grainTimeline: latestAnalysisResult.grainTimeline
      } : undefined
    }])
  }
}, finalDuration * 1000)
```

### createSafeAnalysisResult()

解析失敗時のフォールバック結果を生成

```typescript
const createSafeAnalysisResult = useCallback((type: 'basic' | 'fallback' = 'basic') => {
  const features = type === 'fallback' ? {
    rmsAvg: Math.random() * 0.8 + 0.2,
    rmsMax: Math.random() * 1.0 + 0.5,
    centroidAvg: Math.random() * 2000 + 500,
    centroidMax: Math.random() * 3000 + 1000,
    zcrAvg: Math.random() * 0.2 + 0.05,
    sampleCount: 1
  } : {
    rmsAvg: 0.5,
    rmsMax: 0.8,
    centroidAvg: 1000,
    centroidMax: 1500,
    zcrAvg: 0.1,
    sampleCount: 1
  }

  const intentResult = intentClassifierRef.current.classify(features)
  const pandaSound = intentClassifierRef.current.getRandomPandaSound(intentResult.intent)
  const translation = intentClassifierRef.current.getRandomTranslation(intentResult.intent)

  return { intentResult, pandaSound, translation }
}, [])
```

### イベントハンドラ

#### handleSubmit()

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (userInput.trim() && !isSpeaking) {
    await performSpeech(userInput.trim())
  }
}
```

#### handleQuickQuestion()

```typescript
const handleQuickQuestion = async (question: string) => {
  if (!isSpeaking) {
    await performSpeech(question)
  }
}
```

#### handleVoiceInput()

```typescript
const handleVoiceInput = async (voiceText: string) => {
  if (!isSpeaking && !isThinking) {
    await performSpeech(voiceText)
  }
}
```

#### toggleAnalysis()

```typescript
const toggleAnalysis = () => {
  setIsAnalysisEnabled(!isAnalysisEnabled)

  // 解析無効化時は進行中の解析のみクリア
  if (isAnalysisEnabled) {
    setIsAnalyzing(false)
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }
  }
}
```

#### handleShareCard()

```typescript
const handleShareCard = () => {
  setShowShareCard(true)
}
```

## useEffect フック

### クライアント初期化

```typescript
useEffect(() => {
  // クライアントマウント検知
  setIsClientMounted(true)

  // セッション開始時刻の初期化
  if (!sessionStartTime) {
    setSessionStartTime(new Date())
  }

  // localStorageからpandaMemoryを読み込み
  const actualMemory = loadPandaMemory()
  setPandaMemory(actualMemory)
}, [sessionStartTime])
```

### クリーンアップ

```typescript
useEffect(() => {
  return () => {
    if (autoSpeakTimer.current) {
      clearTimeout(autoSpeakTimer.current)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
  }
}, [])
```

## UI 構成

### レイアウト構造

```tsx
<div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex flex-col">
  {/* ヘッダー */}
  <div className="bg-white/80 backdrop-blur-sm border-b border-white/30 p-4 flex-shrink-0">
    <h1>しゃべれっさー！</h1>
    <p>レッサーパンダとの"おしゃべり"体験</p>
  </div>

  {/* メインコンテンツ（チャット履歴） */}
  <div className="flex-1 flex flex-col overflow-hidden">
    <ChatHistory
      messages={chatMessages}
      isAnalysisEnabled={isAnalysisEnabled}
      analyserBridge={analyserBridge}
      isAnalyzing={isAnalyzing}
    />
  </div>

  {/* 固定入力エリア */}
  <FixedInputArea
    userInput={userInput}
    setUserInput={setUserInput}
    onSubmit={handleSubmit}
    onQuickQuestion={handleQuickQuestion}
    onVoiceInput={handleVoiceInput}
    isDisabled={isDisabled}
    isThinking={isThinking}
    isSpeaking={isSpeaking}
  />

  {/* フローティングステータスパネル */}
  <StatusPanel
    isAnalysisEnabled={isAnalysisEnabled}
    onToggleAnalysis={toggleAnalysis}
    pandaMemory={pandaMemory}
    relationshipName={getIntimacyLevelName(pandaMemory.intimacyLevel)}
    intimacyMessage={getIntimacyMessage(pandaMemory.intimacyLevel)}
    isAnimating={intimacyAnimating}
    onShareCard={handleShareCard}
    isClientMounted={isClientMounted}
    getMilestoneTitle={getMilestoneTitle}
    analyserBridge={analyserBridge}
    latestAnalysisResult={latestAnalysisResult}
    isAnalyzing={isAnalyzing}
  />

  {/* フッター */}
  <footer className="bg-white/60 backdrop-blur-sm border-t border-white/30 p-4 text-center flex-shrink-0">
    <p>この翻訳は擬似的な演出です</p>
    <a href="https://www.city.sabae.fukui.jp/nishiyama_zoo/">西山動物園で会いに来てね🐾</a>
  </footer>

  {/* マイルストーン通知 */}
  {showMilestone && (
    <MilestoneNotification
      newUnlocks={newUnlocks}
      onClose={() => { setShowMilestone(false); setNewUnlocks([]) }}
    />
  )}

  {/* シェアカード生成 */}
  {showShareCard && (
    <ShareCardGenerator
      cardData={{ ... }}
      audioContext={audioContextRef.current}
      onClose={() => setShowShareCard(false)}
    />
  )}
</div>
```

## SSR 対応

### pandaMemory の初期化

```typescript
const [pandaMemory, setPandaMemory] = useState<PandaMemory>(() => {
  // SSR時は常に初期値を返す
  if (typeof window === 'undefined') {
    return {
      totalConversations: 0,
      uniqueDays: 0,
      // ... 初期値
    }
  }
  return loadPandaMemory()
})
```

### CSR専用コンポーネント

```typescript
import dynamic from 'next/dynamic'

const SpectrumPanel = dynamic(() => import('@/components/SpectrumPanel'), { ssr: false })
const TranslationCaption = dynamic(() => import('@/components/TranslationCaption'), { ssr: false })
```

## エラーハンドリング

### AnalyserBridge 作成失敗

```typescript
try {
  const analyser = createAnalyser(audioContextRef.current)
  setAnalyserBridge(analyser)
} catch (error) {
  console.error('❌ Failed to create analyser:', error)
  // 解析なしで従来の音声再生にフォールバック
}
```

### サンプル数ゼロ

```typescript
if (aggregate.sampleCount > 0) {
  // 正常な解析結果を使用
} else {
  console.warn('⚠️ No samples collected for analysis, generating fallback results')
  const fallbackResult = createSafeAnalysisResult('fallback')
  setLatestAnalysisResult(fallbackResult)
}
```

### 音声合成失敗

```typescript
try {
  await performSpeech(input)
} catch (error) {
  console.error('Speech synthesis failed:', error)
  setIsSpeaking(false)
}
```

## パフォーマンス最適化

### useCallback の使用

```typescript
const performSpeech = useCallback(async (input: string, isUserInput: boolean = true) => {
  // ...
}, [isSpeaking, pandaMemory, sessionStartTime, createSafeAnalysisResult])
```

### State 更新の最適化

```typescript
// 配列の更新は spread operator を使用
setChatMessages(prev => [...prev, newMessage])

// 不要な再レンダリングを防ぐ
if (updatedMemory.intimacyLevel > previousIntimacy) {
  setIntimacyAnimating(true)
}
```

## デバッグログ

### 主要ログポイント

```typescript
console.log('🏠 Component mounting/updating...')
console.log('🎤 performSpeech called:', { input, isUserInput })
console.log('🔄 Starting speech performance...')
console.log('🔬 Creating analyser bridge...')
console.log('🎵 Starting analysis-enabled speech synthesis')
console.log('📊 Sampling features:', count)
console.log('🔍 Processing analysis results...')
console.log('🎯 Classification result:', intentResult)
console.log('🐼 Panda sound:', pandaSound)
console.log('🗣️ Translation:', translation)
```

## 関連ドキュメント

- [データフロー全体図](../architecture/data-flow.md)
- [音声解析システム](../features/audio-analysis.md)
- [粒合成システム](../features/speech-synthesis.md)
- [親密度システム](../features/intimacy-system.md)
