// Audio analysis custom hook

import { useState, useRef, useCallback } from 'react'
// createAnalyserは動的importで使用
import { FeatureAggregator, extractFeatures } from '@/lib/audio/featureExtractor'
import { IntentClassifier } from '@/lib/audio/intentClassifier'
// initializeAudioContextは動的importで使用
import type { AnalyserBridge, IntentResult, GrainTimeline } from '@/types/audio'
import { ANALYSIS_CONFIG, DEBUG_CONFIG } from '@/config/analysisConfig'

interface UseAudioAnalysisReturn {
  // State
  audioContext: AudioContext | null
  analyserBridge: AnalyserBridge | null
  isAnalysisEnabled: boolean
  isAnalyzing: boolean
  currentIntentResult: IntentResult | null
  currentPandaSound: string
  currentTranslation: string
  currentGrainTimeline: GrainTimeline[]
  audioInitialized: boolean

  // Actions
  toggleAnalysis: () => void
  initializeAudio: () => Promise<AnalyserBridge | null>
  initializeAudioContext: () => Promise<AudioContext | null>
  startAnalysis: () => void
  processAnalysisResults: (grainTimeline: GrainTimeline[]) => void
  stopAnalysis: () => void
}

export function useAudioAnalysis(): UseAudioAnalysisReturn {
  // State
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [analyserBridge, setAnalyserBridge] = useState<AnalyserBridge | null>(null)
  const [isAnalysisEnabled, setIsAnalysisEnabled] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentIntentResult, setCurrentIntentResult] = useState<IntentResult | null>(null)
  const [currentPandaSound, setCurrentPandaSound] = useState('')
  const [currentTranslation, setCurrentTranslation] = useState('')
  const [currentGrainTimeline, setCurrentGrainTimeline] = useState<GrainTimeline[]>([])
  const [audioInitialized, setAudioInitialized] = useState(false)

  // Refs
  const featureAggregatorRef = useRef<FeatureAggregator>(new FeatureAggregator())
  const intentClassifierRef = useRef<IntentClassifier>(new IntentClassifier())
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize AudioContext and AnalyserBridge
  const initializeAudio = useCallback(async (): Promise<AnalyserBridge | null> => {
    if (DEBUG_CONFIG.ENABLE_PERFORMANCE_LOGS) {
      console.log('🔧 Initializing audio system...')
    }

    // AudioContext初期化
    if (!audioContext) {
      const { initializeAudioContext } = await import('@/lib/pandaSpeech')
      const newAudioContext = await initializeAudioContext()
      setAudioContext(newAudioContext)
      setAudioInitialized(true)

      // AnalyserBridge作成
      if (isAnalysisEnabled && newAudioContext) {
        try {
          if (DEBUG_CONFIG.ENABLE_PERFORMANCE_LOGS) {
            console.log('🔬 Creating analyser bridge...')
          }
          const { createAnalyser } = await import('@/lib/audio/analyserBridge')
          const analyser = createAnalyser(newAudioContext)
          setAnalyserBridge(analyser)
          return analyser
        } catch (error) {
          console.error('❌ Failed to create analyser:', error)
          return null
        }
      }
    }

    return analyserBridge
  }, [audioContext, isAnalysisEnabled, analyserBridge])

  // Initialize AudioContext only
  const initializeAudioContextOnly = useCallback(async (): Promise<AudioContext | null> => {
    if (DEBUG_CONFIG.ENABLE_PERFORMANCE_LOGS) {
      console.log('🔧 Initializing audio context only...')
    }

    if (!audioContext) {
      // pandaSpeechからのinitializeAudioContextを使用
      const { initializeAudioContext } = await import('@/lib/pandaSpeech')
      const newAudioContext = await initializeAudioContext()
      setAudioContext(newAudioContext)
      setAudioInitialized(true)
      return newAudioContext
    }

    return audioContext
  }, [audioContext])

  // Start analysis process
  const startAnalysis = useCallback(() => {
    if (!analyserBridge) return

    if (DEBUG_CONFIG.ENABLE_ANALYSIS_LOGS) {
      console.log('🎵 Starting analysis...')
    }

    setIsAnalyzing(true)
    featureAggregatorRef.current.clear()

    // 特徴量サンプリング開始
    analysisIntervalRef.current = setInterval(() => {
      if (analyserBridge) {
        const frequencyData = analyserBridge.getFrequencyFrame()
        const timeData = analyserBridge.getTimeFrame()
        const features = extractFeatures(frequencyData, timeData, ANALYSIS_CONFIG.SAMPLING_RATE)
        featureAggregatorRef.current.addSample(features)
      }
    }, ANALYSIS_CONFIG.SAMPLING_INTERVAL_MS)
  }, [analyserBridge])

  // Process analysis results
  const processAnalysisResults = useCallback((grainTimeline: GrainTimeline[]) => {
    console.log('🔍 processAnalysisResults called, analysisIntervalRef.current:', !!analysisIntervalRef.current)
    if (!analysisIntervalRef.current) {
      console.warn('⚠️ processAnalysisResults: No analysis interval ref, returning early')
      return
    }

    // サンプリング停止
    clearInterval(analysisIntervalRef.current)
    analysisIntervalRef.current = null

    // 特徴量集計と分類
    const aggregate = featureAggregatorRef.current.getAggregate()
    if (DEBUG_CONFIG.ENABLE_ANALYSIS_LOGS) {
      console.log('📊 Feature aggregate:', aggregate)
    }

    if (aggregate.sampleCount > 0) {
      const intentResult = intentClassifierRef.current.classify(aggregate)
      const pandaSound = intentClassifierRef.current.getRandomPandaSound(intentResult.intent)
      const translation = intentClassifierRef.current.getRandomTranslation(intentResult.intent)

      if (DEBUG_CONFIG.ENABLE_ANALYSIS_LOGS) {
        console.log('🎯 Classification result:', { intent: intentResult.intent, confidence: intentResult.confidence })
        console.log('🐼 Panda sound:', pandaSound)
        console.log('🗣️ Translation:', translation)
      }

      setCurrentIntentResult(intentResult)
      setCurrentPandaSound(pandaSound)
      setCurrentTranslation(translation)
      setCurrentGrainTimeline(grainTimeline)
    } else if (DEBUG_CONFIG.ENABLE_ANALYSIS_LOGS) {
      console.warn('⚠️ No samples collected for analysis')
    }
  }, [])

  // Stop analysis
  const stopAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }

    setTimeout(() => {
      setIsAnalyzing(false)
    }, ANALYSIS_CONFIG.ANALYSIS_END_DELAY_MS)
  }, [])

  // Toggle analysis feature
  const toggleAnalysis = useCallback(() => {
    const newEnabled = !isAnalysisEnabled
    setIsAnalysisEnabled(newEnabled)

    if (DEBUG_CONFIG.ENABLE_STATE_LOGS) {
      console.log('🔄 Analysis toggled:', newEnabled)
    }

    // 解析無効化時は状態をクリア
    if (!newEnabled) {
      setCurrentIntentResult(null)
      setCurrentPandaSound('')
      setCurrentTranslation('')
      setCurrentGrainTimeline([])
      setIsAnalyzing(false)

      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current)
        analysisIntervalRef.current = null
      }
    }
  }, [isAnalysisEnabled])

  return {
    // State
    audioContext,
    analyserBridge,
    isAnalysisEnabled,
    isAnalyzing,
    currentIntentResult,
    currentPandaSound,
    currentTranslation,
    currentGrainTimeline,
    audioInitialized,

    // Actions
    toggleAnalysis,
    initializeAudio,
    initializeAudioContext: initializeAudioContextOnly,
    startAnalysis,
    processAnalysisResults,
    stopAnalysis
  }
}