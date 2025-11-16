/**
 * Panda Learning Custom Hook
 *
 * 親密度学習機能を提供するカスタムフック
 * - PandaMemory の管理
 * - 会話記録と親密度計算
 * - マイルストーン通知
 * - localStorage への永続化
 */

import { useState, useCallback } from 'react'
import {
  loadPandaMemory,
  savePandaMemory,
  recordConversation,
  getIntimacyAdjustedParams,
  getIntimacyMessage,
  getIntimacyLevelName,
  type PandaMemory
} from '@/lib/pandaLearning'
import { type SpeechParams } from '@/lib/pandaSpeech'

export interface ConversationInput {
  userInput: string
  pandaReply: {
    id: number
    translation: string
  }
  sessionDuration: number
}

export interface UsePandaLearningConfig {
  enabled: boolean
}

export interface UsePandaLearningReturn {
  // State
  pandaMemory: PandaMemory
  intimacyAnimating: boolean
  sessionStartTime: Date | null
  newUnlocks: string[]
  showMilestone: boolean
  showShareCard: boolean

  // Actions
  initializeMemory: () => void
  recordUserConversation: (input: ConversationInput) => {
    updatedMemory: PandaMemory
    intimacyIncreased: boolean
    newUnlocks: string[]
  }
  getAdjustedParams: (baseParams: SpeechParams) => SpeechParams
  getIntimacyDisplayMessage: () => string
  getIntimacyDisplayLevel: () => string
  setIntimacyAnimating: (value: boolean) => void
  setShowMilestone: (value: boolean) => void
  setShowShareCard: (value: boolean) => void
  setNewUnlocks: (unlocks: string[]) => void
  resetSessionStartTime: () => void
}

export function usePandaLearning(config: UsePandaLearningConfig): UsePandaLearningReturn {
  const { enabled } = config

  // State
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

  // PandaMemory を初期化（クライアントサイドでのみ実行）
  const initializeMemory = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    console.log('🧠 Initializing panda memory from localStorage...')
    const actualMemory = loadPandaMemory()
    setPandaMemory(actualMemory)

    // セッション開始時刻を設定
    if (!sessionStartTime) {
      setSessionStartTime(new Date())
    }

    console.log('✅ Panda memory initialized:', {
      intimacyLevel: actualMemory.intimacyLevel,
      totalConversations: actualMemory.totalConversations,
      preferredStyle: actualMemory.preferredResponseStyle
    })
  }, [sessionStartTime])

  // セッション開始時刻をリセット
  const resetSessionStartTime = useCallback(() => {
    setSessionStartTime(new Date())
  }, [])

  // 会話を記録して親密度を更新
  const recordUserConversation = useCallback((input: ConversationInput): {
    updatedMemory: PandaMemory
    intimacyIncreased: boolean
    newUnlocks: string[]
  } => {
    if (!enabled) {
      return {
        updatedMemory: pandaMemory,
        intimacyIncreased: false,
        newUnlocks: []
      }
    }

    console.log('📝 Recording conversation:', {
      userInput: input.userInput,
      sessionDuration: input.sessionDuration
    })

    const previousIntimacy = pandaMemory.intimacyLevel
    const previousUnlocks = [...pandaMemory.specialUnlocks]

    // 会話記録と親密度計算
    const updatedMemory = recordConversation(
      pandaMemory,
      input.userInput,
      input.pandaReply,
      input.sessionDuration
    )

    // State と localStorage を更新
    setPandaMemory(updatedMemory)
    savePandaMemory(updatedMemory)

    // 親密度が上がったかチェック
    const intimacyIncreased = updatedMemory.intimacyLevel > previousIntimacy

    // 新しい解放をチェック
    const newUnlocksList = updatedMemory.specialUnlocks.filter(
      unlock => !previousUnlocks.includes(unlock)
    )

    if (intimacyIncreased) {
      console.log('💖 Intimacy increased:', {
        from: previousIntimacy,
        to: updatedMemory.intimacyLevel
      })
    }

    if (newUnlocksList.length > 0) {
      console.log('🎉 New unlocks:', newUnlocksList)
    }

    return {
      updatedMemory,
      intimacyIncreased,
      newUnlocks: newUnlocksList
    }
  }, [enabled, pandaMemory])

  // 親密度に基づいてパラメータを調整
  const getAdjustedParams = useCallback((baseParams: SpeechParams): SpeechParams => {
    return getIntimacyAdjustedParams(
      baseParams,
      pandaMemory.intimacyLevel,
      pandaMemory.preferredResponseStyle
    )
  }, [pandaMemory.intimacyLevel, pandaMemory.preferredResponseStyle])

  // 親密度メッセージを取得
  const getIntimacyDisplayMessage = useCallback((): string => {
    return getIntimacyMessage(pandaMemory.intimacyLevel)
  }, [pandaMemory.intimacyLevel])

  // 親密度レベル名を取得
  const getIntimacyDisplayLevel = useCallback((): string => {
    return getIntimacyLevelName(pandaMemory.intimacyLevel)
  }, [pandaMemory.intimacyLevel])

  return {
    // State
    pandaMemory,
    intimacyAnimating,
    sessionStartTime,
    newUnlocks,
    showMilestone,
    showShareCard,

    // Actions
    initializeMemory,
    recordUserConversation,
    getAdjustedParams,
    getIntimacyDisplayMessage,
    getIntimacyDisplayLevel,
    setIntimacyAnimating,
    setShowMilestone,
    setShowShareCard,
    setNewUnlocks,
    resetSessionStartTime
  }
}
