// Speech synthesis utilities

import { selectPandaReply } from '@/data/replies'
import {
  speakLikePandaWithAnalysis,
  speakLikePanda,
  createVariedSpeechParams,
  type SpeechAnalysisResult
} from '@/lib/pandaSpeech'
import { getIntimacyAdjustedParams } from '@/lib/pandaLearning'
import type { AnalyserBridge } from '@/types/audio'
import { DEBUG_CONFIG } from '@/config/analysisConfig'

export interface SpeechProcessingResult {
  speechResult: SpeechAnalysisResult
  reply: any
  intent: 'greeting' | 'hungry' | 'playful' | 'random'
}

export async function processSpeechSynthesis(
  input: string,
  audioContext: AudioContext,
  intimacyLevel: number,
  preferredStyle: 'mixed' | 'cute' | 'energetic',
  analyserBridge?: AnalyserBridge,
  isAnalysisEnabled: boolean = false
): Promise<SpeechProcessingResult> {

  // 返答を選択
  const reply = selectPandaReply(input)

  // 意図に応じたベースパラメータを生成
  let intent: 'greeting' | 'hungry' | 'playful' | 'random' = 'random'
  if (reply.id === 1) intent = 'hungry'
  else if (reply.id === 2) intent = 'playful'
  else if (reply.id === 3) intent = 'greeting'

  const baseSpeechParams = createVariedSpeechParams(intent)

  // 親密度に基づいてパラメータを調整
  const intimacyAdjustedParams = getIntimacyAdjustedParams(
    baseSpeechParams,
    intimacyLevel,
    preferredStyle
  )

  // 音声合成実行
  let speechResult: SpeechAnalysisResult

  if (isAnalysisEnabled && analyserBridge) {
    if (DEBUG_CONFIG.ENABLE_PERFORMANCE_LOGS) {
      console.log('🎵 Starting analysis-enabled speech synthesis')
    }

    // 解析は呼び出し側で開始される

    speechResult = await speakLikePandaWithAnalysis(
      audioContext,
      reply.src,
      intimacyAdjustedParams,
      analyserBridge
    )
  } else {
    if (DEBUG_CONFIG.ENABLE_PERFORMANCE_LOGS) {
      console.log('🎵 Starting traditional speech synthesis')
    }

    const duration = await speakLikePanda(audioContext, reply.src, intimacyAdjustedParams)
    speechResult = {
      actualDuration: duration,
      grainTimeline: []
    }
  }

  return {
    speechResult,
    reply,
    intent
  }
}

export function createSpeechTimeoutHandler(
  duration: number,
  onComplete: () => void
): NodeJS.Timeout {
  const finalDuration = duration + 0.5 // 0.5秒の余裕を追加
  return setTimeout(onComplete, finalDuration * 1000)
}