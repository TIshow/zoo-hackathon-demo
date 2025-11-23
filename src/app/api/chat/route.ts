import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PANDA_SYSTEM_PROMPT } from '@/lib/llm/pandaPersona'
import type { ConversationMessage } from '@/lib/llm/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { userInput, conversationHistory } = await request.json() as {
      userInput: string
      conversationHistory: ConversationMessage[]
    }

    if (!userInput) {
      return NextResponse.json({ error: 'userInput is required' }, { status: 400 })
    }

    // 会話履歴をClaude形式に変換
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: userInput }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: PANDA_SYSTEM_PROMPT,
      messages
    })

    // レスポンスからテキストを抽出
    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response')
    }

    // JSONをパース
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // JSONが見つからない場合はフォールバック
      return NextResponse.json({
        translation: textContent.text,
        pandaSound: 'キュッ・キュ〜',
        intent: 'greeting',
        confidence: 0.8,
        isFromLLM: true
      })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      translation: parsed.translation || textContent.text,
      pandaSound: parsed.pandaSound || 'キュッ・キュ〜',
      intent: parsed.intent || 'greeting',
      confidence: 0.9,
      isFromLLM: true
    })

  } catch (error) {
    console.error('Claude API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate response', details: errorMessage },
      { status: 500 }
    )
  }
}
