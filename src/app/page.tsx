'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import MilestoneNotification from '@/components/MilestoneNotification'
import ShareCardGenerator from '@/components/ShareCardGenerator'
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis'
import { usePandaLearning } from '@/hooks/usePandaLearning'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import { useChatHistory } from '@/hooks/useChatHistory'
import { getMilestoneTitle } from '@/data/replies'
import { generatePandaResponse } from '@/lib/llm/client'
import type { ConversationMessage } from '@/lib/llm/types'
import ChatHistory from '@/components/ChatHistory'
import FixedInputArea from '@/components/FixedInputArea'
import StatusPanel from '@/components/StatusPanel'

export default function Home() {
  const [userInput, setUserInput] = useState('')
  const [isClientMounted, setIsClientMounted] = useState(false)
  const [isLLMEnabled, setIsLLMEnabled] = useState(false)
  // Custom Hooks
  const chatHistory = useChatHistory()
  const speechSynthesis = useSpeechSynthesis({
    enabled: true
  })
  const audioAnalysis = useAudioAnalysis({
    audioContext: speechSynthesis.audioContext,
    enabled: true
  })
  const pandaLearning = usePandaLearning({
    enabled: true
  })

  // クライアントサイドでの初期化
  useEffect(() => {
    setIsClientMounted(true)
    pandaLearning.initializeMemory()
    speechSynthesis.initializeAudio()
  }, [pandaLearning.sessionStartTime])


  // 音声発話処理
  const performSpeech = useCallback(async (input: string, isUserInput: boolean = true) => {
    if (speechSynthesis.isSpeaking) {
      return
    }

    try {
      if (isUserInput) {
        chatHistory.addUserMessage(input)
      }

      speechSynthesis.setIsThinking(true)
      await new Promise(resolve => setTimeout(resolve, 250))
      speechSynthesis.setIsThinking(false)
      speechSynthesis.setIsSpeaking(true)

      // analyserBridgeを確保
      let currentAnalyserBridge = audioAnalysis.analyserBridge
      const audioCtx = await speechSynthesis.initializeAudio()

      if (audioCtx && !currentAnalyserBridge) {
        currentAnalyserBridge = await audioAnalysis.initializeAnalyser(audioCtx)
      }

      // analyserBridgeが確保できた場合のみ解析開始
      if (currentAnalyserBridge) {
        audioAnalysis.startAnalysis(currentAnalyserBridge)
      }

      const reply = speechSynthesis.getReplyForInput(input)
      const baseSpeechParams = speechSynthesis.createSpeechParams(reply.id)
      const adjustedParams = pandaLearning.getAdjustedParams(baseSpeechParams)

      const result = await speechSynthesis.performSpeech({
        input,
        isUserInput,
        adjustedParams,
        analyserBridge: currentAnalyserBridge
      })

      if (!result) {
        throw new Error('Speech synthesis failed')
      }

      const { reply: actualReply, speechResult } = result

      speechSynthesis.setCurrentReply(actualReply)

      if (isUserInput) {
        setUserInput('')
        const startTime = pandaLearning.sessionStartTime || new Date()
        const sessionDuration = Math.floor((Date.now() - startTime.getTime()) / 1000)

        const { intimacyIncreased, newUnlocks: newUnlocksList } = pandaLearning.recordUserConversation({
          userInput: input,
          pandaReplyId: actualReply.id,
          sessionDuration: Math.max(sessionDuration, 5)
        })

        if (intimacyIncreased) {
          pandaLearning.setIntimacyAnimating(true)
          setTimeout(() => pandaLearning.setIntimacyAnimating(false), 2000)
        }

        if (newUnlocksList.length > 0) {
          pandaLearning.setNewUnlocks(newUnlocksList)
          pandaLearning.setShowMilestone(true)
        }
        pandaLearning.resetSessionStartTime()
      }

      const finalDuration = speechResult.actualDuration + 0.5

      // 必要な関数を先に取得（クロージャー問題を回避）
      const stopAnalysis = audioAnalysis.stopAnalysisAndProcess
      const setAnalyzing = audioAnalysis.setIsAnalyzing
      const setSpeaking = speechSynthesis.setIsSpeaking
      const addMessage = chatHistory.addPandaMessage
      const setLatestResult = audioAnalysis.setLatestAnalysisResult
      const grainTimeline = speechResult.grainTimeline

      // LLMが有効な場合は並行してAPI呼び出し
      let llmResponsePromise: Promise<import('@/lib/llm/types').LLMResponse | null> | null = null
      if (isLLMEnabled && isUserInput) {
        // 会話履歴をLLM用に変換
        const conversationHistory: ConversationMessage[] = chatHistory.messages
          .slice(-10) // 直近10件のみ
          .map(msg => ({
            role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.content
          }))

        llmResponsePromise = generatePandaResponse(input, conversationHistory)
          .catch(error => {
            console.error('LLM request failed, falling back to local analysis:', error)
            return null
          })
      }

      // 音声再生完了後の処理
      setTimeout(async () => {
        setSpeaking(false)

        let analysisResult: typeof audioAnalysis.latestAnalysisResult = null

        // LLMが有効な場合はLLM結果を待つ、そうでなければローカル解析
        if (llmResponsePromise) {
          const llmResult = await llmResponsePromise
          if (llmResult) {
            analysisResult = {
              intentResult: {
                intent: llmResult.intent as 'greeting' | 'playful' | 'hungry',
                confidence: llmResult.confidence,
                features: { centroidAvg: 0, rmsAvg: 0, rmsMax: 0, centroidMax: 0, sampleCount: 0 }
              },
              pandaSound: llmResult.pandaSound,
              translation: llmResult.translation,
              grainTimeline
            }
            setLatestResult(analysisResult)
          }
        }

        // LLM未使用またはLLM失敗時はローカル解析
        if (!analysisResult) {
          analysisResult = stopAnalysis(grainTimeline)
        }

        setAnalyzing(false)
        if (isUserInput) {
          addMessage(analysisResult || undefined)
        }
      }, finalDuration * 1000)

    } catch (error) {
      console.error('Speech synthesis failed:', error)
      speechSynthesis.setIsSpeaking(false)
    }
  }, [speechSynthesis, pandaLearning, audioAnalysis, chatHistory, isLLMEnabled])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (speechSynthesis.audioContext) {
        speechSynthesis.audioContext.close()
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userInput.trim() && !speechSynthesis.isSpeaking) {
      await performSpeech(userInput.trim())
    }
  }

  const handleQuickQuestion = async (question: string) => {
    if (!speechSynthesis.isSpeaking) {
      await performSpeech(question)
    }
  }

  const handleShareCard = () => {
    pandaLearning.setShowShareCard(true)
  }

  const handleVoiceInput = async (voiceText: string) => {
    if (!speechSynthesis.isSpeaking && !speechSynthesis.isThinking) {
      await performSpeech(voiceText)
    }
  }

  const isDisabled = speechSynthesis.isSpeaking || speechSynthesis.isThinking

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex flex-col">
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/30 p-4 flex-shrink-0">
        <div className="max-w-lg mx-auto text-center">
          <div className="mb-2">
            <div className="w-12 h-12 rounded-full border-2 border-orange-300 overflow-hidden mx-auto">
              <Image src="/red-panda.png" alt="レッサーパンダ" width={48} height={48} className="w-full h-full object-cover" />
            </div>
          </div>
          <h1 className="text-heading-lg text-brand-gradient mb-2">
            しゃべれっさー！
          </h1>
          <p className="text-body text-gray-600">
            レッサーパンダとの&quot;おしゃべり&quot;体験
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatHistory
          messages={chatHistory.messages}
          isAnalyzing={audioAnalysis.isAnalyzing}
        />
      </div>

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

      <StatusPanel
        pandaMemory={pandaLearning.pandaMemory}
        relationshipName={pandaLearning.getIntimacyDisplayLevel()}
        intimacyMessage={pandaLearning.getIntimacyDisplayMessage()}
        isAnimating={pandaLearning.intimacyAnimating}
        onShareCard={handleShareCard}
        isClientMounted={isClientMounted}
        getMilestoneTitle={getMilestoneTitle}
        latestAnalysisResult={audioAnalysis.latestAnalysisResult}
        isAnalyzing={audioAnalysis.isAnalyzing}
        isLLMEnabled={isLLMEnabled}
        onToggleLLM={setIsLLMEnabled}
      />

      <footer className="bg-white/60 backdrop-blur-sm border-t border-white/30 p-4 text-center flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-orange-100/80 text-orange-700 px-3 py-1.5 rounded-full text-xs mb-2">
            <span>ℹ️</span>
            <span>この翻訳は擬似的な演出です</span>
          </div>
          <p className="text-caption">
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

      {pandaLearning.showMilestone && (
        <MilestoneNotification
          newUnlocks={pandaLearning.newUnlocks}
          onClose={() => {
            pandaLearning.setShowMilestone(false)
            pandaLearning.setNewUnlocks([])
          }}
        />
      )}

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
