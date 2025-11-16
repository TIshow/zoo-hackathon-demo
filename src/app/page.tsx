
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import MilestoneNotification from '@/components/MilestoneNotification'
import ShareCardGenerator from '@/components/ShareCardGenerator'

// 音声解析機能のimport
import type { AnalyserBridge, IntentResult, GrainTimeline } from '@/types/audio'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { usePandaLearning } from '@/hooks/usePandaLearning'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import ChatHistory, { type ChatMessage } from '@/components/ChatHistory'
import FixedInputArea from '@/components/FixedInputArea'
import StatusPanel from '@/components/StatusPanel'

// CSR専用コンポーネント（StatusPanelで使用）

export default function Home() {
  const [userInput, setUserInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]) // 会話履歴
  const [isClientMounted, setIsClientMounted] = useState(false)

  // 音声解析機能
  const [isAnalysisEnabled, setIsAnalysisEnabled] = useState(true)

  // useSpeechSynthesis Hook を使用
  const speechSynthesis = useSpeechSynthesis({
    enabled: true
  })

  // useAudioAnalysis Hook を使用
  const audioAnalysis = useAudioAnalysis({
    audioContext: speechSynthesis.audioContext,
    enabled: isAnalysisEnabled
  })

  // usePandaLearning Hook を使用
  const pandaLearning = usePandaLearning({
    enabled: true
  })

  const autoSpeakTimer = useRef<NodeJS.Timeout | null>(null)

  // クライアントサイドでの初期化
  useEffect(() => {
    console.log('🏠 Component mounting/updating...')

    // クライアントマウント検知
    setIsClientMounted(true)

    // PandaMemory を初期化
    pandaLearning.initializeMemory()

    // AudioContext を初期化
    speechSynthesis.initializeAudio()

    console.log('📊 Component state:', {
      isAnalysisEnabled,
      hasAnalyserBridge: !!audioAnalysis.analyserBridge,
      hasAudioContext: !!speechSynthesis.audioContext,
      isClientMounted
    })
  }, [pandaLearning.sessionStartTime]) // sessionStartTimeを依存配列に追加


  // 音声発話処理（学習システム統合版）
  const performSpeech = useCallback(async (input: string, isUserInput: boolean = true) => {
    console.log('🎤 performSpeech called:', { input, isUserInput, isSpeaking: speechSynthesis.isSpeaking, isAnalysisEnabled })

    if (speechSynthesis.isSpeaking) {
      console.log('⏸️ Already speaking, returning early')
      return
    }

    console.log('🔄 Starting speech performance...')

    // 新しい解析を開始する前に、前回の状態をクリア
    if (isAnalysisEnabled) {
      audioAnalysis.clearCurrentResults()
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
      speechSynthesis.setIsThinking(true)
      await new Promise(resolve => setTimeout(resolve, 250))
      speechSynthesis.setIsThinking(false)

      speechSynthesis.setIsSpeaking(true)

      // AnalyserBridgeの作成（毎回チェック）
      let currentAnalyserBridge = audioAnalysis.analyserBridge
      if (isAnalysisEnabled && speechSynthesis.audioContext && !currentAnalyserBridge) {
        currentAnalyserBridge = await audioAnalysis.initializeAnalyser()
      }

      // 返答を取得してパラメータを生成
      const reply = speechSynthesis.getReplyForInput(input)
      const baseSpeechParams = speechSynthesis.createSpeechParams(reply.id)

      // 🧠 親密度に基づいてパラメータを調整
      const adjustedParams = pandaLearning.getAdjustedParams(baseSpeechParams)

      // 解析機能付き音声再生
      if (isAnalysisEnabled && currentAnalyserBridge) {
        // 特徴量サンプリング開始
        audioAnalysis.startAnalysis()
      }

      const result = await speechSynthesis.performSpeech({
        input,
        isUserInput,
        adjustedParams,
        analyserBridge: currentAnalyserBridge,
        isAnalysisEnabled
      })

      if (!result) {
        throw new Error('Speech synthesis failed')
      }

      const { reply: actualReply, speechResult } = result

      // 解析機能が無効でも基本的な解析結果を生成
      if (isAnalysisEnabled && !currentAnalyserBridge) {
        audioAnalysis.setIsAnalyzing(true)

        // 基本的な解析結果を生成
        const basicResult = audioAnalysis.createSafeAnalysisResult('basic')
        console.log('🎯 Basic analysis result:', { intent: basicResult.intentResult?.intent, confidence: basicResult.intentResult?.confidence })
        console.log('🐼 Basic panda sound:', basicResult.pandaSound)
        console.log('🗣️ Basic translation:', basicResult.translation)
      }

      // 翻訳表示
      speechSynthesis.setCurrentReply(actualReply)
      if (isUserInput) {
        setUserInput('')
      }

      // 🧠 会話を記録して学習データを更新
      if (isUserInput) {
        // sessionStartTime が null の場合は現在の時刻で初期化
        const startTime = pandaLearning.sessionStartTime || new Date()
        const sessionDuration = Math.floor((Date.now() - startTime.getTime()) / 1000)

        const { intimacyIncreased, newUnlocks: newUnlocksList } = pandaLearning.recordUserConversation({
          userInput: input,
          pandaReply: { id: actualReply.id, translation: actualReply.translation },
          sessionDuration: Math.max(sessionDuration, 5) // 最低5秒のセッション時間
        })

        // 親密度が上がったらアニメーション
        if (intimacyIncreased) {
          pandaLearning.setIntimacyAnimating(true)
          setTimeout(() => pandaLearning.setIntimacyAnimating(false), 2000)
        }

        // 新しい解放があった場合の通知
        if (newUnlocksList.length > 0) {
          pandaLearning.setNewUnlocks(newUnlocksList)
          pandaLearning.setShowMilestone(true)
        }

        // セッション開始時刻をリセット
        pandaLearning.resetSessionStartTime()
      }

      // 解析結果の処理
      if (isAnalysisEnabled) {
        // 解析停止 & 結果生成
        audioAnalysis.stopAnalysisAndProcess(speechResult.grainTimeline)

        // 一定時間後に解析状態を終了
        setTimeout(() => {
          audioAnalysis.setIsAnalyzing(false)
        }, speechResult.actualDuration * 1000 + 500)
      }

      // 実際の音声時間に基づいて発話終了を管理（余裕を持たせて）
      const finalDuration = speechResult.actualDuration + 0.5 // 0.5秒の余裕を追加

      setTimeout(() => {
        speechSynthesis.setIsSpeaking(false)

        // パンダメッセージを会話履歴に追加（発話完了後）
        if (isUserInput) {
          const pandaMessageId = Date.now().toString() + '_panda'
          setChatMessages(prev => [
            ...prev,
            {
              id: pandaMessageId,
              type: 'panda',
              content: actualReply.src,
              timestamp: new Date(),
              reply: actualReply,
              analysisData: isAnalysisEnabled && audioAnalysis.latestAnalysisResult ? {
                intentResult: audioAnalysis.latestAnalysisResult.intentResult,
                pandaSound: audioAnalysis.latestAnalysisResult.pandaSound,
                translation: audioAnalysis.latestAnalysisResult.translation,
                grainTimeline: audioAnalysis.latestAnalysisResult.grainTimeline
              } : undefined
            }
          ])
        }
      }, finalDuration * 1000)

    } catch (error) {
      console.error('Speech synthesis failed:', error)
      speechSynthesis.setIsSpeaking(false)
    }
  }, [speechSynthesis, pandaLearning, isAnalysisEnabled, audioAnalysis])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (autoSpeakTimer.current) {
        clearTimeout(autoSpeakTimer.current)
      }
      if (speechSynthesis.audioContext) {
        speechSynthesis.audioContext.close()
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 Form submitted:', { userInput: userInput.trim(), isSpeaking: speechSynthesis.isSpeaking })
    if (userInput.trim() && !speechSynthesis.isSpeaking) {
      console.log('✅ Calling performSpeech with:', userInput.trim())
      await performSpeech(userInput.trim())
    } else {
      console.log('❌ Submit blocked:', { hasInput: !!userInput.trim(), isSpeaking: speechSynthesis.isSpeaking })
    }
  }

  // よく使う質問から入力されたとき
  const handleQuickQuestion = async (question: string) => {
    console.log('🎯 Quick question clicked:', question)
    if (!speechSynthesis.isSpeaking) {
      console.log('✅ Calling performSpeech from QuickChips')
      await performSpeech(question)
    } else {
      console.log('❌ Quick question blocked, already speaking')
    }
  }

  const toggleAnalysis = () => {
    setIsAnalysisEnabled(!isAnalysisEnabled)
  }

  const handleShareCard = () => {
    pandaLearning.setShowShareCard(true)
  }

  const handleVoiceInput = async (voiceText: string) => {
    console.log('🎤 Voice input received:', voiceText)
    if (!speechSynthesis.isSpeaking && !speechSynthesis.isThinking) {
      console.log('✅ Calling performSpeech from VoiceInput')
      await performSpeech(voiceText)
    } else {
      console.log('❌ Voice input blocked:', { isSpeaking: speechSynthesis.isSpeaking, isThinking: speechSynthesis.isThinking })
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

  const isDisabled = speechSynthesis.isSpeaking || speechSynthesis.isThinking

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
          analyserBridge={audioAnalysis.analyserBridge}
          isAnalyzing={audioAnalysis.isAnalyzing}
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
        isThinking={speechSynthesis.isThinking}
        isSpeaking={speechSynthesis.isSpeaking}
      />

      {/* フローティングステータスパネル */}
      <StatusPanel
        isAnalysisEnabled={isAnalysisEnabled}
        onToggleAnalysis={toggleAnalysis}
        pandaMemory={pandaLearning.pandaMemory}
        relationshipName={pandaLearning.getIntimacyDisplayLevel()}
        intimacyMessage={pandaLearning.getIntimacyDisplayMessage()}
        isAnimating={pandaLearning.intimacyAnimating}
        onShareCard={handleShareCard}
        isClientMounted={isClientMounted}
        getMilestoneTitle={getMilestoneTitle}
        analyserBridge={audioAnalysis.analyserBridge}
        latestAnalysisResult={audioAnalysis.latestAnalysisResult}
        isAnalyzing={audioAnalysis.isAnalyzing}
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
            <a
              href="https://www.city.sabae.fukui.jp/nishiyama_zoo/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-500 transition-colors"
            >
              西山動物園で会いに来てね🐾
            </a>
          </p>
        </div>
      </footer>

      {/* マイルストーン通知 */}
      {pandaLearning.showMilestone && (
        <MilestoneNotification
          newUnlocks={pandaLearning.newUnlocks}
          onClose={() => {
            pandaLearning.setShowMilestone(false)
            pandaLearning.setNewUnlocks([])
          }}
        />
      )}

      {/* シェアカード生成 */}
      {pandaLearning.showShareCard && (
        <ShareCardGenerator
          cardData={{
            intimacyLevel: pandaLearning.pandaMemory.intimacyLevel,
            intimacyLevelName: pandaLearning.getIntimacyDisplayLevel(),
            totalConversations: pandaLearning.pandaMemory.totalConversations,
            uniqueDays: pandaLearning.pandaMemory.uniqueDays,
            consecutiveDays: pandaLearning.pandaMemory.consecutiveDays,
            specialUnlocks: pandaLearning.pandaMemory.specialUnlocks,
            relationshipMessage: pandaLearning.getIntimacyDisplayMessage(),
            timestamp: new Date()
          }}
          audioContext={speechSynthesis.audioContext}
          onClose={() => pandaLearning.setShowShareCard(false)}
        />
      )}
    </div>
  )
}
