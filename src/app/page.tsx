
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
  const [userInput, setUserInput] = useState('')
  const [currentReply, setCurrentReply] = useState<PandaReply | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isThinking, setIsThinking] = useState(false)

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      <main className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-lg space-y-8">
          {/* ヘッダー */}
          <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="mb-3">
              <span className="text-5xl">🐼</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent mb-3">
              しゃべれっさー！
            </h1>
            <p className="text-gray-600 mb-2 font-medium">
              レッサーパンダとの&quot;おしゃべり&quot;体験
            </p>
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-medium">
              <span>🔊</span>
              <span>音量にご注意ください</span>
            </div>
          </div>

          {/* 入力フォーム */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="レッサーパンダに話しかけてね！"
                  className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 disabled:bg-gray-50 transition-all duration-200 placeholder-gray-400"
                  disabled={isDisabled}
                  aria-label="レッサーパンダへのメッセージ入力"
                />
              </div>
              <button
                type="submit"
                disabled={!userInput.trim() || isDisabled}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-xl shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed focus:ring-2 focus:ring-orange-400 focus:outline-none font-medium"
                aria-label="メッセージを送信してレッサーパンダに話しかける"
              >
                {isThinking ? '🤔 考え中...' : isSpeaking ? '🗣️ 鳴いています...' : '💬 話しかける'}
              </button>
            </form>
          </div>

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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/20">
            <label className="flex items-start space-x-4 cursor-pointer group">
              <div className="relative mt-1">
                <input
                  type="checkbox"
                  checked={isAnalysisEnabled}
                  onChange={toggleAnalysis}
                  className="sr-only"
                />
                <div className={`w-6 h-6 rounded-lg border-2 transition-all duration-200 ${
                  isAnalysisEnabled
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 border-blue-500'
                    : 'border-gray-300 group-hover:border-gray-400'
                }`}>
                  {isAnalysisEnabled && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🔬</span>
                  <span className="font-semibold text-gray-800">
                    AI音声解析＆翻訳
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  パンダの鳴き声をリアルタイム解析して意図を推測します
                </p>
              </div>
            </label>
          </div>

          {/* スペクトラム解析パネル */}
          {isAnalysisEnabled && (
            <div className="space-y-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/20">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-xl">📊</span>
                    リアルタイム音声スペクトラム
                  </h3>
                </div>
                <SpectrumPanel
                  analyserBridge={analyserBridge}
                  isActive={isAnalyzing}
                  className="h-32 rounded-xl overflow-hidden"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/20">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-xl">🐼</span>
                    AI翻訳結果
                  </h3>
                </div>
                <TranslationCaption
                  intentResult={currentIntentResult}
                  pandaSound={currentPandaSound}
                  translation={currentTranslation}
                  grainTimeline={currentGrainTimeline}
                  isActive={isAnalyzing}
                  className="min-h-[120px]"
                />
              </div>
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

          {/* 返答吹き出し */}
          <Bubble
            translation={currentReply?.translation || ''}
            isVisible={!!currentReply}
          />

          {/* 学習状況表示 - CSR専用 */}
          {isClientMounted && pandaMemory.totalConversations > 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/20">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-xl">🧠</span>
                  学習状況
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="w-6 text-center">🎨</span>
                  <span>スタイル: <span className="font-medium">{pandaMemory.preferredResponseStyle}</span></span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="w-6 text-center">📈</span>
                  <span>総会話: <span className="font-medium">{pandaMemory.totalConversations}回</span></span>
                </div>
                {pandaMemory.favoriteQuestions.length > 0 && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <span className="w-6 text-center mt-0.5">❤️</span>
                    <span>よく聞く質問: <span className="font-medium">{pandaMemory.favoriteQuestions[0].question}</span></span>
                  </div>
                )}
                {pandaMemory.specialUnlocks.length > 0 && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <span className="w-6 text-center mt-0.5">🏆</span>
                    <span>解放済み: <span className="font-medium">{pandaMemory.specialUnlocks.map(id => getMilestoneTitle(id)).join(', ')}</span></span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white/60 backdrop-blur-sm border-t border-white/30 p-6 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 bg-orange-100/80 text-orange-700 px-4 py-2 rounded-full text-sm">
            <span>ℹ️</span>
            <span>この翻訳は擬似的な演出です</span>
          </div>
          <p className="text-sm text-gray-600">
            園内限定の&quot;特別ボイス&quot;も準備中！<br />
            <span className="font-medium text-orange-600">西山動物園で会いに来てね🐾</span>
          </p>
        </div>
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
