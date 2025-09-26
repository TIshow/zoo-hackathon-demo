
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { selectPandaReply, type PandaReply } from '@/data/replies'
import {
  speakLikePandaWithAnalysis,
  speakLikePanda,
  initializeAudioContext,
  createVariedSpeechParams,
  type SpeechAnalysisResult
} from '@/lib/pandaSpeech'
import {
  loadPandaMemory,
  savePandaMemory,
  recordConversation,
  getIntimacyAdjustedParams,
  getIntimacyMessage,
  getIntimacyLevelName,
  type PandaMemory
} from '@/lib/pandaLearning'
import Bubble from '@/components/Bubble'
import QuickChips from '@/components/QuickChips'
import IntimacyGauge from '@/components/IntimacyGauge'
import MilestoneNotification from '@/components/MilestoneNotification'
import ShareCardGenerator from '@/components/ShareCardGenerator'
import VoiceInput from '@/components/VoiceInput'

// 新機能のimport
import dynamic from 'next/dynamic'
import { createAnalyser } from '@/lib/audio/analyserBridge'
import { FeatureAggregator, extractFeatures } from '@/lib/audio/featureExtractor'
import { IntentClassifier } from '@/lib/audio/intentClassifier'
import type { AnalyserBridge, IntentResult, GrainTimeline } from '@/types/audio'

// CSR専用コンポーネント
const SpectrumPanel = dynamic(() => import('@/components/SpectrumPanel'), { ssr: false })
const TranslationCaption = dynamic(() => import('@/components/TranslationCaption'), { ssr: false })

export default function Home() {
  console.log('🏗️ Home component rendering...')

  const [userInput, setUserInput] = useState('')
  const [currentReply, setCurrentReply] = useState<PandaReply | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)

  // 学習システム関連（SSR対応のため初期値を使用）
  const [pandaMemory, setPandaMemory] = useState<PandaMemory>(() => {
    // SSR時は常に初期値を返す
    if (typeof window === 'undefined') {
      return {
        totalConversations: 0,
        uniqueDays: 0,
        firstMeeting: null,
        lastSeen: null,
        favoriteQuestions: [],
        conversationHistory: [],
        totalSessionTime: 0,
        intimacyLevel: 0,
        longestSession: 0,
        consecutiveDays: 0,
        preferredResponseStyle: 'mixed' as const,
        specialUnlocks: []
      }
    }
    return loadPandaMemory()
  })
  const [intimacyAnimating, setIntimacyAnimating] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [newUnlocks, setNewUnlocks] = useState<string[]>([])
  const [showMilestone, setShowMilestone] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [isClientMounted, setIsClientMounted] = useState(false)

  // 新機能のstate
  const [analyserBridge, setAnalyserBridge] = useState<AnalyserBridge | null>(null)
  const [isAnalysisEnabled, setIsAnalysisEnabled] = useState(true)
  const [currentIntentResult, setCurrentIntentResult] = useState<IntentResult | null>(null)
  const [currentPandaSound, setCurrentPandaSound] = useState('')
  const [currentTranslation, setCurrentTranslation] = useState('')
  const [currentGrainTimeline, setCurrentGrainTimeline] = useState<GrainTimeline[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const autoSpeakTimer = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // 新機能のref
  const featureAggregatorRef = useRef<FeatureAggregator>(new FeatureAggregator())
  const intentClassifierRef = useRef<IntentClassifier>(new IntentClassifier())
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // クライアントサイドでの初期化
  useEffect(() => {
    console.log('🏠 Component mounting/updating...')

    // クライアントマウント検知
    setIsClientMounted(true)

    // セッション開始時刻の初期化
    if (!sessionStartTime) {
      setSessionStartTime(new Date())
    }

    // localStorageからpandaMemoryを読み込み（初回のみ）
    const actualMemory = loadPandaMemory()
    setPandaMemory(actualMemory)

    console.log('📊 Component state:', {
      isAnalysisEnabled,
      hasAnalyserBridge: !!analyserBridge,
      isClientMounted
    })
  }, [sessionStartTime]) // sessionStartTimeを依存配列に追加

  // 音声発話処理（学習システム統合版）
  const performSpeech = useCallback(async (input: string, isUserInput: boolean = true) => {
    console.log('🎤 performSpeech called:', { input, isUserInput, isSpeaking })

    if (isSpeaking) {
      console.log('⏸️ Already speaking, returning early')
      return
    }

    console.log('🔄 Starting speech performance...')

    try {
      // 考え中状態を表示（250ms）
      setIsThinking(true)
      await new Promise(resolve => setTimeout(resolve, 250))
      setIsThinking(false)

      setIsSpeaking(true)

      // 返答を選択
      const reply = selectPandaReply(input)

      // AudioContextの初期化
      if (!audioContextRef.current) {
        audioContextRef.current = await initializeAudioContext()
        setAudioInitialized(true)
      }

      // AnalyserBridgeの作成（毎回チェック）
      let currentAnalyserBridge = analyserBridge
      if (isAnalysisEnabled && audioContextRef.current && !currentAnalyserBridge) {
        try {
          console.log('🔬 Creating analyser bridge...')
          const analyser = createAnalyser(audioContextRef.current)
          setAnalyserBridge(analyser)
          currentAnalyserBridge = analyser // 今回の処理で使用
          console.log('✅ Analyser bridge created successfully')
        } catch (error) {
          console.error('❌ Failed to create analyser:', error)
        }
      }

      // 意図に応じたベースパラメータを生成
      let intent: 'greeting' | 'hungry' | 'playful' | 'random' = 'random'
      if (reply.id === 1) intent = 'hungry'
      else if (reply.id === 2) intent = 'playful'
      else if (reply.id === 3) intent = 'greeting'

      const baseSpeechParams = createVariedSpeechParams(intent)

      // 🧠 親密度に基づいてパラメータを調整
      const intimacyAdjustedParams = getIntimacyAdjustedParams(
        baseSpeechParams,
        pandaMemory.intimacyLevel,
        pandaMemory.preferredResponseStyle
      )

      // 解析機能付き音声再生
      let speechResult: SpeechAnalysisResult
      if (isAnalysisEnabled && currentAnalyserBridge) {
        console.log('🎵 Starting analysis-enabled speech synthesis')

        // 特徴量サンプリング開始
        setIsAnalyzing(true)
        featureAggregatorRef.current.clear()

        // 定期的に特徴量を抽出
        analysisIntervalRef.current = setInterval(() => {
          if (currentAnalyserBridge) {
            const frequencyData = currentAnalyserBridge.getFrequencyFrame()
            const timeData = currentAnalyserBridge.getTimeFrame()
            const features = extractFeatures(frequencyData, timeData)
            featureAggregatorRef.current.addSample(features)
          }
        }, 50) // 20Hz サンプリング

        speechResult = await speakLikePandaWithAnalysis(
          audioContextRef.current,
          reply.src,
          intimacyAdjustedParams,
          currentAnalyserBridge
        )
      } else {
        console.log('⚠️ Using traditional speech synthesis:', {
          isAnalysisEnabled,
          hasAnalyserBridge: !!analyserBridge,
          hasCurrentAnalyserBridge: !!currentAnalyserBridge
        })

        // 従来の方式
        const duration = await speakLikePanda(audioContextRef.current, reply.src, intimacyAdjustedParams)
        speechResult = {
          actualDuration: duration,
          grainTimeline: []
        }
      }

      // 翻訳表示
      setCurrentReply(reply)
      if (isUserInput) {
        setUserInput('')
      }

      // 🧠 会話を記録して学習データを更新
      if (isUserInput) {
        // sessionStartTime が null の場合は現在の時刻で初期化
        const startTime = sessionStartTime || new Date()
        const sessionDuration = Math.floor((Date.now() - startTime.getTime()) / 1000)
        const previousIntimacy = pandaMemory.intimacyLevel
        const previousUnlocks = [...pandaMemory.specialUnlocks]

        const updatedMemory = recordConversation(
          pandaMemory,
          input,
          { id: reply.id, translation: reply.translation },
          Math.max(sessionDuration, 5) // 最低5秒のセッション時間
        )

        setPandaMemory(updatedMemory)
        savePandaMemory(updatedMemory)

        // 親密度が上がったらアニメーション
        if (updatedMemory.intimacyLevel > previousIntimacy) {
          setIntimacyAnimating(true)
          setTimeout(() => setIntimacyAnimating(false), 2000)
        }

        // 新しい解放があった場合の通知
        const newUnlocksList = updatedMemory.specialUnlocks.filter(
          unlock => !previousUnlocks.includes(unlock)
        )

        if (newUnlocksList.length > 0) {
          setNewUnlocks(newUnlocksList)
          setShowMilestone(true)
        }

        // セッション開始時刻をリセット
        setSessionStartTime(new Date())
      }

      // 解析結果の処理
      if (isAnalysisEnabled && analysisIntervalRef.current) {
        // サンプリング停止
        clearInterval(analysisIntervalRef.current)
        analysisIntervalRef.current = null

        // 特徴量集計と分類
        const aggregate = featureAggregatorRef.current.getAggregate()
        console.log('📊 Feature aggregate:', aggregate)

        if (aggregate.sampleCount > 0) {
          const intentResult = intentClassifierRef.current.classify(aggregate)
          const pandaSound = intentClassifierRef.current.getRandomPandaSound(intentResult.intent)
          const translation = intentClassifierRef.current.getRandomTranslation(intentResult.intent)

          console.log('🎯 Classification result:', { intent: intentResult.intent, confidence: intentResult.confidence })
          console.log('🐼 Panda sound:', pandaSound)
          console.log('🗣️ Translation:', translation)

          setCurrentIntentResult(intentResult)
          setCurrentPandaSound(pandaSound)
          setCurrentTranslation(translation)
          setCurrentGrainTimeline(speechResult.grainTimeline)
        } else {
          console.warn('⚠️ No samples collected for analysis')
        }

        // 一定時間後に解析状態を終了
        setTimeout(() => {
          setIsAnalyzing(false)
        }, speechResult.actualDuration * 1000 + 500)
      }

      // 実際の音声時間に基づいて発話終了を管理（余裕を持たせて）
      const finalDuration = speechResult.actualDuration + 0.5 // 0.5秒の余裕を追加

      setTimeout(() => {
        setIsSpeaking(false)
      }, finalDuration * 1000)

    } catch (error) {
      console.error('Speech synthesis failed:', error)
      setIsSpeaking(false)
    }
  }, [isSpeaking, pandaMemory, sessionStartTime])

  // 自動発話処理
  const handleAutoSpeak = useCallback(async () => {
    console.log('🤖 Auto speak triggered')
    if (isSpeaking) {
      console.log('❌ Auto speak blocked, already speaking')
      return
    }

    const randomInput = ['おまかせで鳴く', 'こんにちは', 'あそぼ'][Math.floor(Math.random() * 3)]
    console.log('✅ Calling performSpeech from AutoSpeak:', randomInput)
    await performSpeech(randomInput, false)
  }, [isSpeaking, performSpeech])

  // クリーンアップ
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

  // 自動発話制御
  useEffect(() => {
    if (autoSpeakEnabled && audioInitialized && !isSpeaking) {
      const scheduleNext = () => {
        const delay = Math.random() * 10000 + 10000 // 10-20秒
        autoSpeakTimer.current = setTimeout(async () => {
          if (autoSpeakEnabled && !isSpeaking) {
            await handleAutoSpeak()
          }
          if (autoSpeakEnabled) scheduleNext()
        }, delay)
      }
      scheduleNext()
    } else if (autoSpeakTimer.current) {
      clearTimeout(autoSpeakTimer.current)
      autoSpeakTimer.current = null
    }

    return () => {
      if (autoSpeakTimer.current) {
        clearTimeout(autoSpeakTimer.current)
        autoSpeakTimer.current = null
      }
    }
  }, [autoSpeakEnabled, audioInitialized, isSpeaking, handleAutoSpeak])

  const handleSubmit = async (e: React.FormEvent) => {    
    e.preventDefault()
    console.log('🚀 Form submitted:', { userInput: userInput.trim(), isSpeaking })
    if (userInput.trim() && !isSpeaking) {
      console.log('✅ Calling performSpeech with:', userInput.trim())
      await performSpeech(userInput.trim())
    } else {
      console.log('❌ Submit blocked:', { hasInput: !!userInput.trim(), isSpeaking })
    }
  }

  const handleQuickQuestion = async (question: string) => {
    console.log('🎯 Quick question clicked:', question)
    if (!isSpeaking) {
      console.log('✅ Calling performSpeech from QuickChips')
      await performSpeech(question)
    } else {
      console.log('❌ Quick question blocked, already speaking')
    }
  }

  const toggleAutoSpeak = () => {
    setAutoSpeakEnabled(!autoSpeakEnabled)
  }

  const toggleAnalysis = () => {
    setIsAnalysisEnabled(!isAnalysisEnabled)

    // 解析無効化時は現在の状態をクリア
    if (isAnalysisEnabled) {
      setCurrentIntentResult(null)
      setCurrentPandaSound('')
      setCurrentTranslation('')
      setCurrentGrainTimeline([])
      setIsAnalyzing(false)

      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current)
        analysisIntervalRef.current = null
      }
    }
  }

  const handleShareCard = () => {
    setShowShareCard(true)
  }

  const handleVoiceInput = async (voiceText: string) => {
    console.log('🎤 Voice input received:', voiceText)
    if (!isSpeaking && !isThinking) {
      console.log('✅ Calling performSpeech from VoiceInput')
      await performSpeech(voiceText)
    } else {
      console.log('❌ Voice input blocked:', { isSpeaking, isThinking })
    }
  }

  // マイルストーンIDからタイトルを取得する関数
  const getMilestoneTitle = (id: string): string => {
    const milestoneData: Record<string, string> = {
      chatty_friend: 'おしゃべり好き',
      close_buddy: '親密な友達',
      regular_visitor: '常連さん',
      weekly_friend: '1週間の友',
      early_bird: '朝の友達',
      night_owl: '夜ふかし友達',
      long_talker: 'おしゃべり上手'
    }
    return milestoneData[id] || id
  }

  const isDisabled = isSpeaking || isThinking

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200">
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-6">
          {/* ヘッダー */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-orange-900 mb-2">
              🐼 しゃべれっさー！ 🐼
            </h1>
            <p className="text-sm text-gray-600 mb-1">
              レッサーパンダと&quot;おしゃべり&quot;（模擬翻訳）
            </p>
            <p className="text-xs text-orange-600 font-medium">
              🔊 音量にご注意ください
            </p>
          </div>

          {/* 入力フォーム */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="レッサーパンダに話しかけてね..."
                className="w-full px-4 py-3 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent disabled:bg-gray-50"
                disabled={isDisabled}
                aria-label="レッサーパンダへのメッセージ入力"
              />
            </div>
            <button
              type="submit"
              disabled={!userInput.trim() || isDisabled}
              className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed focus:ring-2 focus:ring-orange-300 focus:outline-none"
              aria-label="メッセージを送信してレッサーパンダに話しかける"
            >
              {isThinking ? '考え中...' : isSpeaking ? '鳴いています...' : '話しかける'}
            </button>
          </form>

          {/* 音声入力 */}
          <VoiceInput
            onVoiceInput={handleVoiceInput}
            disabled={isDisabled}
            isProcessing={isSpeaking || isThinking}
          />

          {/* プリセット質問 */}
          <QuickChips
            onQuickQuestion={handleQuickQuestion}
            disabled={isDisabled}
          />

          {/* AI解析機能の切り替え */}
          <div className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnalysisEnabled}
                onChange={toggleAnalysis}
                className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-300"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  🔬 AI音声解析＆翻訳
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  パンダの鳴き声をリアルタイム解析して意図を推測します
                </p>
              </div>
            </label>
          </div>

          {/* スペクトラム解析パネル */}
          {isAnalysisEnabled && (
            <div className="space-y-4">
              <SpectrumPanel
                analyserBridge={analyserBridge}
                isActive={isAnalyzing}
                className="h-32"
              />

              <TranslationCaption
                intentResult={currentIntentResult}
                pandaSound={currentPandaSound}
                translation={currentTranslation}
                grainTimeline={currentGrainTimeline}
                isActive={isAnalyzing}
                className="min-h-[160px]"
              />
            </div>
          )}

          {/* 🧠 親密度ゲージ */}
          <IntimacyGauge
            intimacyLevel={pandaMemory.intimacyLevel}
            totalConversations={pandaMemory.totalConversations}
            relationshipName={getIntimacyLevelName(pandaMemory.intimacyLevel)}
            message={getIntimacyMessage(pandaMemory.intimacyLevel)}
            isAnimating={intimacyAnimating}
            onShareCard={handleShareCard}
          />

          {/* 自動発話トグル */}
          <div className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSpeakEnabled}
                onChange={toggleAutoSpeak}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-300"
                aria-describedby="auto-speak-description"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  🧪 実験：パンダが&quot;自由にしゃべる&quot;
                </span>
                <p id="auto-speak-description" className="text-xs text-gray-500 mt-1" suppressHydrationWarning>
                  10〜20秒ごとに自動で鳴きます（親密度:{pandaMemory.intimacyLevel}%）
                </p>
              </div>
            </label>
          </div>

          {/* 返答吹き出し */}
          <Bubble
            translation={currentReply?.translation || ''}
            isVisible={!!currentReply}
          />

          {/* 学習状況表示（デバッグ用） - CSR専用 */}
          {isClientMounted && pandaMemory.totalConversations > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-600 space-y-1">
                <div>🧠 学習状況: {pandaMemory.preferredResponseStyle}スタイル</div>
                <div>📈 総会話: {pandaMemory.totalConversations}回</div>
                {pandaMemory.favoriteQuestions.length > 0 && (
                  <div>❤️ よく聞く質問: {pandaMemory.favoriteQuestions[0].question}</div>
                )}
                {pandaMemory.specialUnlocks.length > 0 && (
                  <div>🏆 解放済み: {pandaMemory.specialUnlocks.map(id => getMilestoneTitle(id)).join(', ')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-orange-50 border-t border-orange-200 p-4 text-center text-xs text-gray-600">
        <p className="mb-1">
          ※ この翻訳は擬似的な演出です。実際の鳴き声の意味を保証するものではありません。
        </p>
        <p>
          園内限定の&quot;特別ボイス&quot;も準備中！西山動物園で会いに来てね🐾
        </p>
      </footer>

      {/* マイルストーン通知 */}
      {showMilestone && (
        <MilestoneNotification
          newUnlocks={newUnlocks}
          onClose={() => {
            setShowMilestone(false)
            setNewUnlocks([])
          }}
        />
      )}

      {/* シェアカード生成 */}
      {showShareCard && (
        <ShareCardGenerator
          cardData={{
            intimacyLevel: pandaMemory.intimacyLevel,
            intimacyLevelName: getIntimacyLevelName(pandaMemory.intimacyLevel),
            totalConversations: pandaMemory.totalConversations,
            uniqueDays: pandaMemory.uniqueDays,
            consecutiveDays: pandaMemory.consecutiveDays,
            specialUnlocks: pandaMemory.specialUnlocks,
            relationshipMessage: getIntimacyMessage(pandaMemory.intimacyLevel),
            timestamp: new Date()
          }}
          audioContext={audioContextRef.current}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  )
}
