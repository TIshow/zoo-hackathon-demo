/**
 * Chat History Custom Hook
 *
 * 会話履歴管理を提供するカスタムフック
 * - メッセージの追加・管理
 * - ユーザー/パンダメッセージの作成
 * - 履歴のクリア
 */

import { useState, useCallback } from 'react'
import type { PandaReply } from '@/data/replies'
import type { IntentResult, GrainTimeline } from '@/types/audio'

export interface ChatMessage {
  id: string
  type: 'user' | 'panda'
  content: string
  timestamp: Date
  reply?: PandaReply
  analysisData?: {
    intentResult: IntentResult | null
    pandaSound: string
    translation: string
    grainTimeline: GrainTimeline[]
  }
}

export interface AnalysisData {
  intentResult: IntentResult | null
  pandaSound: string
  translation: string
  grainTimeline: GrainTimeline[]
}

export interface UseChatHistoryReturn {
  // State
  messages: ChatMessage[]

  // Actions
  addUserMessage: (content: string) => string
  addPandaMessage: (reply: PandaReply, analysisData?: AnalysisData) => void
  clearHistory: () => void
}

export function useChatHistory(): UseChatHistoryReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // ユーザーメッセージを追加
  const addUserMessage = useCallback((content: string): string => {
    const messageId = Date.now().toString()
    const newMessage: ChatMessage = {
      id: messageId,
      type: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
    console.log('💬 User message added:', { id: messageId, content })

    return messageId
  }, [])

  // パンダメッセージを追加
  const addPandaMessage = useCallback((reply: PandaReply, analysisData?: AnalysisData): void => {
    const messageId = Date.now().toString() + '_panda'
    const newMessage: ChatMessage = {
      id: messageId,
      type: 'panda',
      content: reply.src,
      timestamp: new Date(),
      reply,
      analysisData
    }

    setMessages(prev => [...prev, newMessage])
    console.log('🐼 Panda message added:', {
      id: messageId,
      reply: reply.translation,
      hasAnalysis: !!analysisData
    })
  }, [])

  // 履歴をクリア
  const clearHistory = useCallback(() => {
    setMessages([])
    console.log('🗑️ Chat history cleared')
  }, [])

  return {
    // State
    messages,

    // Actions
    addUserMessage,
    addPandaMessage,
    clearHistory
  }
}
