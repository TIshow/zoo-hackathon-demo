/**
 * Audio Analysis Custom Hook
 *
 * 音声解析機能を提供するカスタムフック
 * - AnalyserBridge の管理
 * - リアルタイム特徴量抽出
 * - Intent 分類
 * - 解析結果の永続化
 */

import { useState, useRef, useCallback } from 'react'
import { createAnalyser } from '@/lib/audio/analyserBridge'
import { FeatureAggregator, extractFeatures } from '@/lib/audio/featureExtractor'
import { IntentClassifier } from '@/lib/audio/intentClassifier'
import type { AnalyserBridge, IntentResult, GrainTimeline } from '@/types/audio'

export interface AnalysisResult {
  intentResult: IntentResult | null
  pandaSound: string
  translation: string
  grainTimeline: GrainTimeline[]
}

export interface UseAudioAnalysisConfig {
  audioContext: AudioContext | null
  enabled: boolean
}

export interface UseAudioAnalysisReturn {
  // State
  analyserBridge: AnalyserBridge | null
  isAnalyzing: boolean
  latestAnalysisResult: AnalysisResult | null

  // Actions
  initializeAnalyser: (ctx?: AudioContext) => Promise<AnalyserBridge | null>
  startAnalysis: (bridge?: AnalyserBridge) => void
  stopAnalysisAndProcess: (grainTimeline: GrainTimeline[]) => AnalysisResult | null
  setIsAnalyzing: (value: boolean) => void
}

export function useAudioAnalysis(config: UseAudioAnalysisConfig): UseAudioAnalysisReturn {
  const { audioContext, enabled } = config

  // State
  const [analyserBridge, setAnalyserBridge] = useState<AnalyserBridge | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [latestAnalysisResult, setLatestAnalysisResult] = useState<AnalysisResult | null>(null)

  // Refs
  const featureAggregatorRef = useRef<FeatureAggregator>(new FeatureAggregator())
  const intentClassifierRef = useRef<IntentClassifier>(new IntentClassifier())
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // AnalyserBridge 初期化
  const initializeAnalyser = useCallback(async (ctx?: AudioContext): Promise<AnalyserBridge | null> => {
    // 既に存在する場合は返す
    if (analyserBridge) {
      return analyserBridge
    }

    if (!enabled) {
      return null
    }

    // 引数で渡されたcontextを優先、なければhookのaudioContextを使用
    const contextToUse = ctx || audioContext
    if (!contextToUse) {
      return null
    }

    try {
      const analyser = createAnalyser(contextToUse)
      setAnalyserBridge(analyser)
      return analyser
    } catch (error) {
      console.error('Failed to create analyser:', error)
      return null
    }
  }, [audioContext, enabled, analyserBridge])


  // 解析開始
  const startAnalysis = useCallback((bridge?: AnalyserBridge) => {
    // 引数で渡されたbridgeを優先、なければstateのanalyserBridgeを使用
    const bridgeToUse = bridge || analyserBridge

    if (!enabled || !bridgeToUse) {
      return
    }

    setIsAnalyzing(true)
    featureAggregatorRef.current.clear()

    // 既存のインターバルをクリア
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
    }

    // 50ms毎に特徴量をサンプリング
    analysisIntervalRef.current = setInterval(() => {
      if (bridgeToUse) {
        const frequencyData = bridgeToUse.getFrequencyFrame()
        const timeData = bridgeToUse.getTimeFrame()
        const features = extractFeatures(frequencyData, timeData)
        featureAggregatorRef.current.addSample(features)

      }
    }, 50) // 20Hz サンプリング
  }, [enabled, analyserBridge])

  // 解析停止 & 結果生成
  const stopAnalysisAndProcess = useCallback((grainTimeline: GrainTimeline[]): AnalysisResult | null => {
    if (!enabled) {
      return null
    }

    // サンプリング停止
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }

    // 特徴量集計と分類
    const aggregate = featureAggregatorRef.current.getAggregate()

    if (aggregate.sampleCount === 0) {
      return null
    }

    const intentResult = intentClassifierRef.current.classify(aggregate)
    const pandaSound = intentClassifierRef.current.getRandomPandaSound(intentResult.intent)
    const translation = intentClassifierRef.current.getRandomTranslation(intentResult.intent)

    const result: AnalysisResult = { intentResult, pandaSound, translation, grainTimeline }
    setLatestAnalysisResult(result)

    return result
  }, [enabled])

  return {
    // State
    analyserBridge,
    isAnalyzing,
    latestAnalysisResult,

    // Actions
    initializeAnalyser,
    startAnalysis,
    stopAnalysisAndProcess,
    setIsAnalyzing
  }
}
