/**
 * LLM関連の型定義
 */

export interface LLMConfig {
  enabled: boolean
  model?: string
  maxTokens?: number
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  userInput: string
  conversationHistory: ConversationMessage[]
  audioFeatures?: {
    intent: string
    confidence: number
  }
}

export interface LLMResponse {
  translation: string
  pandaSound: string
  intent: string
  confidence: number
  isFromLLM: boolean
}
