/**
 * Speech Synthesis Custom Hook
 *
 * 音声合成機能を提供するカスタムフック
 * - AudioContext の管理
 * - 音声再生処理
 * - 発話状態管理
 * - 返答選択とパラメータ生成
 */

import { useState, useRef, useCallback } from 'react'
import { selectPandaReply, type PandaReply } from '@/data/replies'
import {
  speakLikePandaWithAnalysis,
  speakLikePanda,
  initializeAudioContext,
  createVariedSpeechParams,
  type SpeechAnalysisResult,
  type SpeechParams
} from '@/lib/pandaSpeech'
import type { AnalyserBridge } from '@/types/audio'

export interface SpeechRequest {
  input: string
  isUserInput: boolean
  adjustedParams: SpeechParams
  analyserBridge: AnalyserBridge | null
  isAnalysisEnabled: boolean
}

export interface SpeechResult {
  reply: PandaReply
  speechResult: SpeechAnalysisResult
}

export interface UseSpeechSynthesisConfig {
  enabled: boolean
}

export interface UseSpeechSynthesisReturn {
  // State
  audioContext: AudioContext | null
  isSpeaking: boolean
  isThinking: boolean
  currentReply: PandaReply | null

  // Actions
  initializeAudio: () => Promise<AudioContext | null>
  performSpeech: (request: SpeechRequest) => Promise<SpeechResult | null>
  setIsSpeaking: (value: boolean) => void
  setIsThinking: (value: boolean) => void
  setCurrentReply: (reply: PandaReply | null) => void
  getReplyForInput: (input: string) => PandaReply
  createSpeechParams: (replyId: number) => SpeechParams
}

export function useSpeechSynthesis(config: UseSpeechSynthesisConfig): UseSpeechSynthesisReturn {
  const { enabled } = config

  // State
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [currentReply, setCurrentReply] = useState<PandaReply | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // AudioContext を初期化
  const initializeAudio = useCallback(async (): Promise<AudioContext | null> => {
    if (!enabled) {
      return null
    }

    if (audioContextRef.current) {
      return audioContextRef.current
    }

    try {
      const context = await initializeAudioContext()
      audioContextRef.current = context
      return context
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error)
      return null
    }
  }, [enabled])

  // 入力に対する返答を選択
  const getReplyForInput = useCallback((input: string): PandaReply => {
    return selectPandaReply(input)
  }, [])

  // 返答IDから意図を判定してスピーチパラメータを生成
  const createSpeechParams = useCallback((replyId: number): SpeechParams => {
    let intent: 'greeting' | 'hungry' | 'playful' | 'random' = 'random'
    if (replyId === 1) intent = 'hungry'
    else if (replyId === 2) intent = 'playful'
    else if (replyId === 3) intent = 'greeting'

    return createVariedSpeechParams(intent)
  }, [])

  // 音声合成を実行
  const performSpeech = useCallback(async (request: SpeechRequest): Promise<SpeechResult | null> => {
    if (!enabled) {
      return null
    }

    const { input, adjustedParams, analyserBridge, isAnalysisEnabled } = request

    try {
      // AudioContext を確保
      const context = await initializeAudio()
      if (!context) {
        throw new Error('AudioContext not available')
      }

      // 返答を選択
      const reply = getReplyForInput(input)

      // 音声再生
      let speechResult: SpeechAnalysisResult

      if (isAnalysisEnabled && analyserBridge) {
        speechResult = await speakLikePandaWithAnalysis(
          context,
          reply.src,
          adjustedParams,
          analyserBridge
        )
      } else {
        const duration = await speakLikePanda(context, reply.src, adjustedParams)
        speechResult = {
          actualDuration: duration,
          grainTimeline: []
        }
      }

      return { reply, speechResult }
    } catch (error) {
      console.error('Speech synthesis failed:', error)
      throw error
    }
  }, [enabled, initializeAudio, getReplyForInput])

  return {
    // State
    audioContext: audioContextRef.current,
    isSpeaking,
    isThinking,
    currentReply,

    // Actions
    initializeAudio,
    performSpeech,
    setIsSpeaking,
    setIsThinking,
    setCurrentReply,
    getReplyForInput,
    createSpeechParams
  }
}
