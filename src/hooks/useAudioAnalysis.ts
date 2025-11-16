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
  currentIntentResult: IntentResult | null
  currentPandaSound: string
  currentTranslation: string
  currentGrainTimeline: GrainTimeline[]

  // Actions
  initializeAnalyser: () => Promise<AnalyserBridge | null>
  clearCurrentResults: () => void
  startAnalysis: () => void
  stopAnalysisAndProcess: (grainTimeline: GrainTimeline[]) => AnalysisResult | null
  createSafeAnalysisResult: (type?: 'basic' | 'fallback') => AnalysisResult
  setIsAnalyzing: (value: boolean) => void
}

export function useAudioAnalysis(config: UseAudioAnalysisConfig): UseAudioAnalysisReturn {
  const { audioContext, enabled } = config

  // State
  const [analyserBridge, setAnalyserBridge] = useState<AnalyserBridge | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [latestAnalysisResult, setLatestAnalysisResult] = useState<AnalysisResult | null>(null)

  // 一時的な解析結果（音声再生中のみ有効）
  const [currentIntentResult, setCurrentIntentResult] = useState<IntentResult | null>(null)
  const [currentPandaSound, setCurrentPandaSound] = useState('')
  const [currentTranslation, setCurrentTranslation] = useState('')
  const [currentGrainTimeline, setCurrentGrainTimeline] = useState<GrainTimeline[]>([])

  // Refs
  const featureAggregatorRef = useRef<FeatureAggregator>(new FeatureAggregator())
  const intentClassifierRef = useRef<IntentClassifier>(new IntentClassifier())
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // AnalyserBridge 初期化
  const initializeAnalyser = useCallback(async (): Promise<AnalyserBridge | null> => {
    if (!audioContext || !enabled || analyserBridge) {
      return analyserBridge
    }

    try {
      console.log('🔬 Creating analyser bridge...')
      const analyser = createAnalyser(audioContext)
      setAnalyserBridge(analyser)
      console.log('✅ Analyser bridge created successfully')
      return analyser
    } catch (error) {
      console.error('❌ Failed to create analyser:', error)
      return null
    }
  }, [audioContext, enabled, analyserBridge])

  // 現在の解析結果をクリア
  const clearCurrentResults = useCallback(() => {
    console.log('🔄 Clearing previous analysis state...')
    setCurrentIntentResult(null)
    setCurrentPandaSound('')
    setCurrentTranslation('')
    setCurrentGrainTimeline([])
  }, [])

  // フォールバック結果を生成
  const createSafeAnalysisResult = useCallback((type: 'basic' | 'fallback' = 'basic'): AnalysisResult => {
    const features = type === 'fallback' ? {
      rmsAvg: Math.random() * 0.8 + 0.2,
      rmsMax: Math.random() * 1.0 + 0.5,
      centroidAvg: Math.random() * 2000 + 500,
      centroidMax: Math.random() * 3000 + 1000,
      zcrAvg: Math.random() * 0.2 + 0.05,
      sampleCount: 1
    } : {
      rmsAvg: 0.5,
      rmsMax: 0.8,
      centroidAvg: 1000,
      centroidMax: 1500,
      zcrAvg: 0.1,
      sampleCount: 1
    }

    const intentResult = intentClassifierRef.current.classify(features)
    const pandaSound = intentClassifierRef.current.getRandomPandaSound(intentResult.intent)
    const translation = intentClassifierRef.current.getRandomTranslation(intentResult.intent)

    return { intentResult, pandaSound, translation, grainTimeline: [] }
  }, [])

  // 解析開始
  const startAnalysis = useCallback(() => {
    if (!enabled || !analyserBridge) {
      console.log('⚠️ Analysis disabled or analyser not ready')
      return
    }

    console.log('🎵 Starting analysis-enabled speech synthesis with analyser:', !!analyserBridge)
    setIsAnalyzing(true)
    featureAggregatorRef.current.clear()

    // 50ms毎に特徴量をサンプリング
    analysisIntervalRef.current = setInterval(() => {
      if (analyserBridge) {
        const frequencyData = analyserBridge.getFrequencyFrame()
        const timeData = analyserBridge.getTimeFrame()
        const features = extractFeatures(frequencyData, timeData)
        featureAggregatorRef.current.addSample(features)

        // 10サンプルごとにログ
        if (featureAggregatorRef.current.getAggregate().sampleCount % 10 === 0) {
          console.log('📊 Sampling features:', featureAggregatorRef.current.getAggregate().sampleCount)
        }
      }
    }, 50) // 20Hz サンプリング
  }, [enabled, analyserBridge])

  // 解析停止 & 結果生成
  const stopAnalysisAndProcess = useCallback((grainTimeline: GrainTimeline[]): AnalysisResult | null => {
    if (!enabled) {
      return null
    }

    console.log('🔍 Processing analysis results...', {
      hasInterval: !!analysisIntervalRef.current,
      isEnabled: enabled
    })

    // サンプリング停止
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }

    // 特徴量集計と分類
    const aggregate = featureAggregatorRef.current.getAggregate()
    console.log('📊 Feature aggregate:', aggregate)

    let result: AnalysisResult

    if (aggregate.sampleCount > 0) {
      const intentResult = intentClassifierRef.current.classify(aggregate)
      const pandaSound = intentClassifierRef.current.getRandomPandaSound(intentResult.intent)
      const translation = intentClassifierRef.current.getRandomTranslation(intentResult.intent)

      console.log('🎯 Classification result:', { intent: intentResult.intent, confidence: intentResult.confidence })
      console.log('🐼 Panda sound:', pandaSound)
      console.log('🗣️ Translation:', translation)

      result = { intentResult, pandaSound, translation, grainTimeline }

      // 現在の解析結果を設定
      setCurrentIntentResult(intentResult)
      setCurrentPandaSound(pandaSound)
      setCurrentTranslation(translation)
      setCurrentGrainTimeline(grainTimeline)
    } else {
      console.warn('⚠️ No samples collected for analysis, generating fallback results')
      result = createSafeAnalysisResult('fallback')

      // フォールバック結果を設定
      setCurrentIntentResult(result.intentResult)
      setCurrentPandaSound(result.pandaSound)
      setCurrentTranslation(result.translation)
      setCurrentGrainTimeline(grainTimeline)
    }

    // 解析結果を永続化
    setLatestAnalysisResult(result)
    console.log('✅ Analysis results set successfully')

    return result
  }, [enabled, createSafeAnalysisResult])

  return {
    // State
    analyserBridge,
    isAnalyzing,
    latestAnalysisResult,
    currentIntentResult,
    currentPandaSound,
    currentTranslation,
    currentGrainTimeline,

    // Actions
    initializeAnalyser,
    clearCurrentResults,
    startAnalysis,
    stopAnalysisAndProcess,
    createSafeAnalysisResult,
    setIsAnalyzing
  }
}
