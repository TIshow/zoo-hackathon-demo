// 学習するパンダシステム - localStorage ベースの擬似学習
// 会話データを蓄積し、親密度に応じて音声パラメータを自動調整

import { SpeechParams } from './pandaSpeech'

export interface ConversationData {
  timestamp: Date
  userInput: string
  pandaResponse: {
    id: number
    translation: string
  }
  sessionDuration: number // 会話継続時間（秒）
}

export interface PandaMemory {
  // 基本統計
  totalConversations: number
  uniqueDays: number
  firstMeeting: Date | null
  lastSeen: Date | null

  // 会話パターン
  favoriteQuestions: Array<{ question: string; count: number }>
  conversationHistory: ConversationData[]
  totalSessionTime: number // 累計会話時間（秒）

  // 親密度指標
  intimacyLevel: number     // 0-100の親密度スコア
  longestSession: number    // 最長会話時間（秒）
  consecutiveDays: number   // 連続来訪日数

  // 学習結果
  preferredResponseStyle: 'gentle' | 'energetic' | 'playful' | 'mixed'
  specialUnlocks: string[] // 解放された特別なレスポンス
}

const STORAGE_KEY = 'panda_memory'
const MAX_HISTORY_SIZE = 100 // 履歴の最大保存数

// ローカルストレージからメモリを読み込み
export function loadPandaMemory(): PandaMemory {
  try {
    // SSRでlocalStorageが利用できない場合の対応
    if (typeof window === 'undefined') {
      return createInitialMemory()
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return createInitialMemory()
    }

    const parsed = JSON.parse(stored)
    // 日付オブジェクトを復元
    parsed.firstMeeting = parsed.firstMeeting ? new Date(parsed.firstMeeting) : null
    parsed.lastSeen = parsed.lastSeen ? new Date(parsed.lastSeen) : null
    parsed.conversationHistory = parsed.conversationHistory.map((conv: ConversationData) => ({
      ...conv,
      timestamp: new Date(conv.timestamp)
    }))

    return parsed
  } catch (error) {
    console.error('Failed to load panda memory:', error)
    return createInitialMemory()
  }
}

// メモリをローカルストレージに保存
export function savePandaMemory(memory: PandaMemory): void {
  try {
    // SSRでlocalStorageが利用できない場合の対応
    if (typeof window === 'undefined') {
      return
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch (error) {
    console.error('Failed to save panda memory:', error)
  }
}

// 初期メモリを作成
function createInitialMemory(): PandaMemory {
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
    preferredResponseStyle: 'mixed',
    specialUnlocks: []
  }
}

// 新しい会話を記録
export function recordConversation(
  memory: PandaMemory,
  userInput: string,
  pandaResponse: { id: number; translation: string },
  sessionDuration: number = 5
): PandaMemory {
  const now = new Date()

  // 初回会話の記録
  if (!memory.firstMeeting) {
    memory.firstMeeting = now
  }

  // 新しい会話データ
  const newConversation: ConversationData = {
    timestamp: now,
    userInput,
    pandaResponse,
    sessionDuration
  }

  // 会話履歴を更新（最大サイズを超えたら古いものを削除）
  memory.conversationHistory.unshift(newConversation)
  if (memory.conversationHistory.length > MAX_HISTORY_SIZE) {
    memory.conversationHistory = memory.conversationHistory.slice(0, MAX_HISTORY_SIZE)
  }

  // 統計更新
  memory.totalConversations++
  memory.totalSessionTime += sessionDuration
  memory.lastSeen = now

  // 最長セッション時間の更新
  if (sessionDuration > memory.longestSession) {
    memory.longestSession = sessionDuration
  }

  // ユニーク日数の計算
  const uniqueDaysSet = new Set(
    memory.conversationHistory.map(conv => conv.timestamp.toDateString())
  )
  memory.uniqueDays = uniqueDaysSet.size

  // 連続来訪日数の計算
  memory.consecutiveDays = calculateConsecutiveDays(memory.conversationHistory)

  // よく使う質問の更新
  updateFavoriteQuestions(memory, userInput)

  // 親密度の再計算
  memory.intimacyLevel = calculateIntimacyLevel(memory)

  // 好みのレスポンススタイル学習
  memory.preferredResponseStyle = learnPreferredStyle(memory)

  // 特別解放の確認
  checkSpecialUnlocks(memory)

  return memory
}

// 親密度レベルを計算（0-100）
export function calculateIntimacyLevel(memory: PandaMemory): number {
  if (memory.totalConversations === 0) return 0

  // 複数の要素から親密度を計算
  const conversationScore = Math.min(memory.totalConversations * 2, 50) // 会話回数（最大50点）
  const timeScore = Math.min(memory.totalSessionTime / 60, 25) // 累計時間（最大25点）
  const regularityScore = Math.min(memory.uniqueDays * 3, 15) // 来訪頻度（最大15点）
  const loyaltyScore = Math.min(memory.consecutiveDays * 2, 10) // 継続性（最大10点）

  const totalScore = conversationScore + timeScore + regularityScore + loyaltyScore
  return Math.min(Math.round(totalScore), 100)
}

// 親密度に基づく音声パラメータの生成
export function getIntimacyAdjustedParams(
  baseParams: SpeechParams,
  intimacyLevel: number,
  preferredStyle: string = 'mixed'
): SpeechParams {
  // 親密度レベルを0-1に正規化
  const intimacy = intimacyLevel / 100

  // 親密度が高いほど表現豊かに
  const expressiveness = 0.5 + (intimacy * 0.5) // 0.5-1.0

  // 基本パラメータに親密度調整を適用
  const adjustedParams: SpeechParams = {
    ...baseParams,
    grainCount: Math.max(2, Math.floor((baseParams.grainCount || 3) * expressiveness)),
    pitchVariation: (baseParams.pitchVariation || 2) * expressiveness,
    useReverb: baseParams.useReverb && intimacy > 0.3, // 30%以上の親密度でリバーブ
  }

  // 好みのスタイルに基づく調整
  switch (preferredStyle) {
    case 'gentle':
      adjustedParams.pitchVariation = Math.max(0.5, (adjustedParams.pitchVariation || 2) * 0.7)
      adjustedParams.speedVariation = [0.9, 1.1]
      break

    case 'energetic':
      adjustedParams.grainCount = (adjustedParams.grainCount || 3) + 1
      adjustedParams.speedVariation = [1.0, 1.2]
      break

    case 'playful':
      adjustedParams.pitchVariation = (adjustedParams.pitchVariation || 2) * 1.3
      adjustedParams.grainInterval = [0.04, 0.12] // 短い間隔でリズミカル
      break
  }

  return adjustedParams
}

// 連続来訪日数を計算
function calculateConsecutiveDays(history: ConversationData[]): number {
  if (history.length === 0) return 0

  const uniqueDays = Array.from(
    new Set(history.map(conv => conv.timestamp.toDateString()))
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  let consecutive = 1
  const oneDay = 24 * 60 * 60 * 1000

  for (let i = 0; i < uniqueDays.length - 1; i++) {
    const current = new Date(uniqueDays[i]).getTime()
    const next = new Date(uniqueDays[i + 1]).getTime()

    if (current - next <= oneDay) {
      consecutive++
    } else {
      break
    }
  }

  return consecutive
}

// よく使う質問を更新
function updateFavoriteQuestions(memory: PandaMemory, userInput: string): void {
  const existing = memory.favoriteQuestions.find(fq => fq.question === userInput)

  if (existing) {
    existing.count++
  } else {
    memory.favoriteQuestions.push({ question: userInput, count: 1 })
  }

  // 使用頻度順にソート（上位10件のみ保持）
  memory.favoriteQuestions.sort((a, b) => b.count - a.count)
  memory.favoriteQuestions = memory.favoriteQuestions.slice(0, 10)
}

// 好みのレスポンススタイルを学習
function learnPreferredStyle(memory: PandaMemory): 'gentle' | 'energetic' | 'playful' | 'mixed' {
  if (memory.conversationHistory.length < 5) return 'mixed'

  // 最近の会話から傾向を分析
  const recentHistory = memory.conversationHistory.slice(0, 20)
  const keywordPatterns = {
    gentle: ['こんにちは', 'ありがとう', 'お疲れ', '大丈夫'],
    energetic: ['頑張って', '元気', '楽しい', 'すごい'],
    playful: ['あそぼ', '面白い', '笑う', 'わーい']
  }

  const scores = { gentle: 0, energetic: 0, playful: 0 }

  recentHistory.forEach(conv => {
    const input = conv.userInput.toLowerCase()
    Object.entries(keywordPatterns).forEach(([style, keywords]) => {
      keywords.forEach(keyword => {
        if (input.includes(keyword)) {
          scores[style as keyof typeof scores]++
        }
      })
    })
  })

  const maxStyle = Object.entries(scores).reduce((max, [style, score]) =>
    score > max.score ? { style: style as keyof typeof scores, score } : max
  , { style: 'mixed' as 'gentle' | 'energetic' | 'playful' | 'mixed', score: 0 })

  return maxStyle.score > 3 ? maxStyle.style : 'mixed'
}

// 特別解放の確認
function checkSpecialUnlocks(memory: PandaMemory): void {
  const unlocks = []

  if (memory.totalConversations >= 10 && !memory.specialUnlocks.includes('chatty_friend')) {
    unlocks.push('chatty_friend')
  }

  if (memory.intimacyLevel >= 50 && !memory.specialUnlocks.includes('close_buddy')) {
    unlocks.push('close_buddy')
  }

  if (memory.consecutiveDays >= 3 && !memory.specialUnlocks.includes('regular_visitor')) {
    unlocks.push('regular_visitor')
  }

  if (memory.uniqueDays >= 7 && !memory.specialUnlocks.includes('weekly_friend')) {
    unlocks.push('weekly_friend')
  }

  memory.specialUnlocks.push(...unlocks)
}

// 親密度に応じたメッセージを生成
export function getIntimacyMessage(intimacyLevel: number): string {
  if (intimacyLevel >= 80) return "もうとっても仲良しだね！🥰"
  if (intimacyLevel >= 60) return "すっかり友達になったね！😊"
  if (intimacyLevel >= 40) return "だいぶ慣れてきたよ～♪"
  if (intimacyLevel >= 20) return "少しずつ仲良しになってるね！"
  if (intimacyLevel >= 5) return "だんだん覚えてきたよ！"
  return "初めまして！よろしくね🐾"
}

// 親密度レベルの段階名を取得
export function getIntimacyLevelName(intimacyLevel: number): string {
  if (intimacyLevel >= 80) return "親友"
  if (intimacyLevel >= 60) return "友達"
  if (intimacyLevel >= 40) return "知り合い"
  if (intimacyLevel >= 20) return "顔見知り"
  if (intimacyLevel >= 5) return "新顔"
  return "はじめまして"
}