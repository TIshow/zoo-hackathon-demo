'use client'

import { useState, useEffect, useRef } from 'react'
import type { IntentResult, GrainTimeline } from '@/types/audio'

interface TranslationCaptionProps {
  intentResult: IntentResult | null
  pandaSound: string
  translation: string
  grainTimeline: GrainTimeline[]
  isActive: boolean
  className?: string
}

interface CaptionState {
  pandaVisible: boolean
  translationVisible: boolean
  currentGrain: number
}

export default function TranslationCaption({
  intentResult,
  pandaSound,
  translation,
  grainTimeline,
  isActive,
  className = ''
}: TranslationCaptionProps) {
  const [captionState, setCaptionState] = useState<CaptionState>({
    pandaVisible: false,
    translationVisible: false,
    currentGrain: 0
  })

  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  // Clear all timeouts
  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
    timeoutRefs.current = []
  }

  // Reset caption state
  const resetCaptions = () => {
    setCaptionState({
      pandaVisible: false,
      translationVisible: false,
      currentGrain: 0
    })
  }

  // Start caption animation sequence
  const startCaptionSequence = () => {
    clearAllTimeouts()

    // Phase 1: Show panda sound immediately
    setCaptionState(prev => ({ ...prev, pandaVisible: true }))

    // Phase 2: Show translation after first grain (or immediately if no grains)
    const firstGrainDelay = grainTimeline.length > 0 ? Math.max(grainTimeline[0]?.startTime || 0, 200) : 200
    const translationTimeout = setTimeout(() => {
      setCaptionState(prev => ({ ...prev, translationVisible: true }))
    }, firstGrainDelay)

    timeoutRefs.current.push(translationTimeout)

    // Phase 3: Keep captions visible after playback completes
    // (翻訳を表示し続けるため、自動非表示は行わない)
  }

  // Effect to start/stop caption sequence
  useEffect(() => {
    // 解析結果がある場合は表示（isActiveの状態に関係なく）
    if (intentResult && pandaSound && translation) {
      startCaptionSequence()
    } else if (!isActive && !intentResult) {
      // 解析が無効、または新しい会話が始まる前のみクリア
      clearAllTimeouts()
      resetCaptions()
    }

    return clearAllTimeouts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, intentResult, pandaSound, translation, grainTimeline])

  // Cleanup on unmount
  useEffect(() => {
    return clearAllTimeouts
  }, [])

  const confidenceColor = intentResult ?
    intentResult.confidence > 0.7 ? 'text-green-400' :
    intentResult.confidence > 0.4 ? 'text-yellow-400' :
    'text-orange-400' : 'text-gray-400'

  const intentEmoji = intentResult ? {
    greeting: '👋',
    playful: '🎈',
    hungry: '🍽️'
  }[intentResult.intent] : '🐼'

  return (
    <div className={`relative bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg border border-slate-700 overflow-hidden ${className}`}>
      {/* Header with AI analysis status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{intentEmoji}</span>
          <span className="text-sm font-medium text-white">AI翻訳</span>
          {intentResult && (
            <span className={`text-xs ${confidenceColor}`}>
              信頼度: {Math.round(intentResult.confidence * 100)}%
            </span>
          )}
        </div>

        {isActive && (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-xs text-cyan-400 font-mono">処理中</span>
          </div>
        )}
      </div>

      {/* Caption content */}
      <div className="p-4 space-y-3 min-h-[100px]">
        {/* Panda sound (upper caption) */}
        <div className={`transition-all duration-500 transform ${
          captionState.pandaVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
        }`}>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-2xl">🐼</span>
            <span className="text-xs text-orange-400 font-medium">パンダ語</span>
          </div>
          <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-3">
            <p className="text-orange-300 font-mono text-lg leading-relaxed">
              {captionState.pandaVisible ? pandaSound : ''}
            </p>
          </div>
        </div>

        {/* Translation (lower caption) */}
        <div className={`transition-all duration-500 transform ${
          captionState.translationVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
        }`}>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-2xl">🗣️</span>
            <span className="text-xs text-blue-400 font-medium">日本語訳</span>
            {intentResult && (
              <span className="text-xs text-slate-400">
                [{intentResult.intent}]
              </span>
            )}
          </div>
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
            <p className="text-blue-200 text-base leading-relaxed">
              {captionState.translationVisible ? translation : ''}
            </p>
          </div>
        </div>

        {/* Debug info (only in development) */}
        {process.env.NODE_ENV === 'development' && intentResult && intentResult.features && (
          <div className="text-xs text-slate-500 space-y-1 border-t border-slate-700 pt-2 mt-2">
            <div>RMS: {typeof intentResult.features.rmsAvg === 'number' ? intentResult.features.rmsAvg.toFixed(3) : 'N/A'}</div>
            <div>Centroid: {typeof intentResult.features.centroidAvg === 'number' ? intentResult.features.centroidAvg.toFixed(0) : 'N/A'}Hz</div>
            {intentResult.features.zcrAvg && typeof intentResult.features.zcrAvg === 'number' && (
              <div>ZCR: {intentResult.features.zcrAvg.toFixed(3)}</div>
            )}
            <div>Samples: {intentResult.features.sampleCount || 0}</div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!isActive && !captionState.pandaVisible && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className="text-slate-400">
            <div className="text-3xl mb-2">🔍</div>
            <div className="text-sm font-medium">AI翻訳待機中</div>
            <div className="text-xs mt-1">パンダの声から意図を推測します</div>
          </div>
        </div>
      )}
    </div>
  )
}