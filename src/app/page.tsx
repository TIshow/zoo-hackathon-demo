
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
import MilestoneNotification from '@/components/MilestoneNotification'
import ShareCardGenerator from '@/components/ShareCardGenerator'

// 新機能のimport
import { createAnalyser } from '@/lib/audio/analyserBridge'
import { FeatureAggregator, extractFeatures } from '@/lib/audio/featureExtractor'
import { IntentClassifier } from '@/lib/audio/intentClassifier'
import type { AnalyserBridge, IntentResult, GrainTimeline } from '@/types/audio'
import ChatHistory, { type ChatMessage } from '@/components/ChatHistory'
import FixedInputArea from '@/components/FixedInputArea'
import StatusPanel from '@/components/StatusPanel'

// CSR専用コンポーネント（StatusPanelで使用）

export default function Home() {
  const [userInput, setUserInput] = useState('')
  const [currentReply, setCurrentReply] = useState<PandaReply | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]) // 会話履歴

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

  // 最新の解析結果を永続化（音声終了後も保持）
  const [latestAnalysisResult, setLatestAnalysisResult] = useState<{
    intentResult: IntentResult | null
    pandaSound: string
    translation: string
    grainTimeline: GrainTimeline[]
  } | null>(null)

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

  // 安全な解析結果を生成するヘルパー関数
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

  // 音声発話処理（学習システム統合版）
  const performSpeech = useCallback(async (input: string, isUserInput: boolean = true) => {
    console.log('🎤 performSpeech called:', { input, isUserInput, isSpeaking, isAnalysisEnabled })

    if (isSpeaking) {
      console.log('⏸️ Already speaking, returning early')
      return
    }

    console.log('🔄 Starting speech performance...')

    // 新しい解析を開始する前に、前回の状態をクリア
    if (isAnalysisEnabled) {
      console.log('🔄 Clearing previous analysis state...')
      setCurrentIntentResult(null)
      setCurrentPandaSound('')
      setCurrentTranslation('')
      setCurrentGrainTimeline([])
    }

    try {
      // ユーザーメッセージを会話履歴に追加（isUserInputがtrueの場合のみ）
      const userMessageId = Date.now().toString()
      if (isUserInput) {
        setChatMessages(prev => [
          ...prev,
          {
            id: userMessageId,
            type: 'user',
            content: input,
            timestamp: new Date()
          }
        ])
      }

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
        console.log('🎵 Starting analysis-enabled speech synthesis with analyser:', !!currentAnalyserBridge)

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
            // ログでサンプリングを確認
            if (featureAggregatorRef.current.getAggregate().sampleCount % 10 === 0) {
              console.log('📊 Sampling features:', featureAggregatorRef.current.getAggregate().sampleCount)
            }
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

        // 解析機能が無効でも基本的な解析結果を生成
        if (isAnalysisEnabled) {
          setIsAnalyzing(true)

          // 基本的な解析結果を生成
          const { intentResult: basicIntentResult, pandaSound: basicPandaSound, translation: basicTranslation } = createSafeAnalysisResult('basic')

          console.log('🎯 Basic analysis result:', { intent: basicIntentResult.intent, confidence: basicIntentResult.confidence })
          console.log('🐼 Basic panda sound:', basicPandaSound)
          console.log('🗣️ Basic translation:', basicTranslation)

          setCurrentIntentResult(basicIntentResult)
          setCurrentPandaSound(basicPandaSound)
          setCurrentTranslation(basicTranslation)
          setCurrentGrainTimeline([])

          setLatestAnalysisResult({
            intentResult: basicIntentResult,
            pandaSound: basicPandaSound,
            translation: basicTranslation,
            grainTimeline: []
          })
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
      if (isAnalysisEnabled) {
        console.log('🔍 Processing analysis results...', {
          hasInterval: !!analysisIntervalRef.current,
          isAnalysisEnabled,
          speechResultDuration: speechResult.actualDuration
        })

        // サンプリング停止
        if (analysisIntervalRef.current) {
          clearInterval(analysisIntervalRef.current)
          analysisIntervalRef.current = null
        }

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

          // 現在の解析結果を設定
          setCurrentIntentResult(intentResult)
          setCurrentPandaSound(pandaSound)
          setCurrentTranslation(translation)
          setCurrentGrainTimeline(speechResult.grainTimeline)

          // 解析結果を永続化（音声終了後も保持）
          setLatestAnalysisResult({
            intentResult,
            pandaSound,
            translation,
            grainTimeline: speechResult.grainTimeline
          })

          console.log('✅ Analysis results set successfully')
        } else {
          console.warn('⚠️ No samples collected for analysis, generating fallback results')

          // サンプルがなくても基本的な解析結果を生成
          const { intentResult: fallbackIntentResult, pandaSound: fallbackPandaSound, translation: fallbackTranslation } = createSafeAnalysisResult('fallback')

          console.log('🎯 Fallback analysis result:', { intent: fallbackIntentResult.intent, confidence: fallbackIntentResult.confidence })
          console.log('🐼 Fallback panda sound:', fallbackPandaSound)
          console.log('🗣️ Fallback translation:', fallbackTranslation)

          setCurrentIntentResult(fallbackIntentResult)
          setCurrentPandaSound(fallbackPandaSound)
          setCurrentTranslation(fallbackTranslation)
          setCurrentGrainTimeline(speechResult.grainTimeline)

          setLatestAnalysisResult({
            intentResult: fallbackIntentResult,
            pandaSound: fallbackPandaSound,
            translation: fallbackTranslation,
            grainTimeline: speechResult.grainTimeline
          })

          console.log('✅ Fallback analysis results set successfully')
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

        // パンダメッセージを会話履歴に追加（発話完了後）
        if (isUserInput) {
          const pandaMessageId = Date.now().toString() + '_panda'
          setChatMessages(prev => [
            ...prev,
            {
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
            }
          ])
        }
      }, finalDuration * 1000)

    } catch (error) {
      console.error('Speech synthesis failed:', error)
      setIsSpeaking(false)
    }
  }, [isSpeaking, pandaMemory, sessionStartTime, createSafeAnalysisResult])

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

    // 解析無効化時は進行中の解析のみクリア（永続化された結果は保持）
    if (isAnalysisEnabled) {
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/30 p-4 flex-shrink-0">
        <div className="max-w-lg mx-auto text-center">
          <div className="mb-2">
            <span className="text-4xl">🐼</span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent mb-2">
            しゃべれっさー！
          </h1>
          <p className="text-gray-600 text-sm font-medium">
            レッサーパンダとの&quot;おしゃべり&quot;体験
          </p>
        </div>
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

      {/* フッター（固定） */}
      <footer className="bg-white/60 backdrop-blur-sm border-t border-white/30 p-4 text-center flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-orange-100/80 text-orange-700 px-3 py-1.5 rounded-full text-xs mb-2">
            <span>ℹ️</span>
            <span>この翻訳は擬似的な演出です</span>
          </div>
          <p className="text-xs text-gray-600">
            園内限定の&quot;特別ボイス&quot;も準備中！
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
