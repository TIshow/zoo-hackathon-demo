/**
 * LLM クライアント
 * Claude APIとの通信を担当
 */

import type { ConversationMessage, LLMResponse } from './types'

export async function generatePandaResponse(
  userInput: string,
  conversationHistory: ConversationMessage[]
): Promise<LLMResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInput, conversationHistory })
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return response.json()
}
