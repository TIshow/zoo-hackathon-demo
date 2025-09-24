import { useState, useEffect, useRef, useCallback } from 'react'
import { VoiceInputManager, VoiceLevelMonitor, SpeechBuffer, type SpeechRecognitionResult } from '@/lib/speechRecognition'

interface VoiceInputProps {
  onVoiceInput: (text: string) => void
  disabled?: boolean
  isProcessing?: boolean
}

export default function VoiceInput({ onVoiceInput, disabled = false, isProcessing = false }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [voiceLevel, setVoiceLevel] = useState(0)
  const [finalText, setFinalText] = useState('')

  const voiceManagerRef = useRef<VoiceInputManager | null>(null)
  const levelMonitorRef = useRef<VoiceLevelMonitor | null>(null)
  const speechBufferRef = useRef<SpeechBuffer | null>(null)

  const cleanup = useCallback(() => {
    if (voiceManagerRef.current) {
      voiceManagerRef.current.stopListening()
    }
    if (levelMonitorRef.current) {
      levelMonitorRef.current.cleanup()
    }
    if (speechBufferRef.current) {
      speechBufferRef.current.cleanup()
    }
  }, [])

  // 初期化
  useEffect(() => {
    setIsSupported(VoiceInputManager.isSupported())

    if (VoiceInputManager.isSupported()) {
      voiceManagerRef.current = new VoiceInputManager()
      levelMonitorRef.current = new VoiceLevelMonitor()
      speechBufferRef.current = new SpeechBuffer(1500, 2) // 1.5秒デバウンス、2文字以上

      // 音声確定時のコールバック
      speechBufferRef.current.setOnFinalResult((text) => {
        setFinalText(text)
        onVoiceInput(text)
        setCurrentTranscript('') // クリア
      })
    }

    return cleanup
  }, [onVoiceInput, cleanup])

  // マイクアクセス権限の確認
  const checkPermission = useCallback(async () => {
    try {
      const hasAccess = await VoiceInputManager.requestMicrophonePermission()
      setHasPermission(hasAccess)
      setError(hasAccess ? null : 'マイクの使用許可が必要です')
      return hasAccess
    } catch {
      setHasPermission(false)
      setError('マイクにアクセスできません')
      return false
    }
  }, [])

  // 音声認識開始
  const startListening = useCallback(async () => {
    if (!voiceManagerRef.current || !levelMonitorRef.current || !speechBufferRef.current) return
    if (isListening || disabled || isProcessing) return

    // 権限確認
    if (hasPermission === null) {
      const granted = await checkPermission()
      if (!granted) return
    } else if (!hasPermission) {
      await checkPermission()
      return
    }

    try {
      setError(null)
      setCurrentTranscript('')
      setFinalText('')

      // 音量監視開始
      await levelMonitorRef.current.initialize()
      levelMonitorRef.current.startMonitoring(setVoiceLevel)

      // 音声認識開始
      await voiceManagerRef.current.startListening(
        (result: SpeechRecognitionResult) => {
          setCurrentTranscript(result.transcript)
          speechBufferRef.current?.addResult(result)
        },
        (error: string) => {
          setError(error)
          setIsListening(false)
          levelMonitorRef.current?.stopMonitoring()
        },
        () => {
          setIsListening(true)
        },
        () => {
          setIsListening(false)
          levelMonitorRef.current?.stopMonitoring()
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '音声認識を開始できませんでした')
    }
  }, [isListening, disabled, isProcessing, hasPermission, checkPermission])

  // 音声認識停止
  const stopListening = useCallback(() => {
    if (voiceManagerRef.current) {
      voiceManagerRef.current.stopListening()
    }
    if (levelMonitorRef.current) {
      levelMonitorRef.current.stopMonitoring()
    }
    if (speechBufferRef.current) {
      speechBufferRef.current.clear()
    }
    setCurrentTranscript('')
    setVoiceLevel(0)
  }, [])

  // トグル
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // 音声レベルに基づくビジュアル
  const getLevelColor = (level: number) => {
    if (level < 10) return 'bg-gray-300'
    if (level < 30) return 'bg-green-400'
    if (level < 60) return 'bg-yellow-400'
    return 'bg-red-400'
  }

  const getLevelIntensity = (level: number) => {
    return Math.max(0.3, level / 100) // 最小30%の透明度
  }

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="text-sm text-yellow-600">
          🚫 お使いのブラウザは音声認識に対応していません
        </div>
        <div className="text-xs text-yellow-500 mt-1">
          Chrome、Edge、Safari でお試しください
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-orange-200 shadow-sm p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🎤</span>
          <div>
            <h3 className="font-medium text-sm text-gray-700">
              音声で話しかける
            </h3>
            <p className="text-xs text-gray-500">
              マイクボタンを押して話してください
            </p>
          </div>
        </div>

        {/* 音声レベル表示 */}
        {isListening && (
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-1 transition-all duration-100 ${getLevelColor(voiceLevel)}`}
                style={{
                  height: `${Math.max(4, (voiceLevel / 100) * 20 + Math.random() * 8)}px`,
                  opacity: getLevelIntensity(voiceLevel)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* メインボタン */}
      <div className="text-center mb-3">
        <button
          onClick={toggleListening}
          disabled={disabled || isProcessing || (hasPermission === false)}
          className={`relative w-16 h-16 rounded-full transition-all duration-200 ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg`}
        >
          <span className="text-2xl">
            {isProcessing ? '🤔' : isListening ? '🔴' : '🎤'}
          </span>

          {/* 波紋エフェクト */}
          {isListening && (
            <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
          )}
        </button>

        <div className="mt-2 text-xs text-gray-600">
          {isProcessing
            ? 'パンダが考えています...'
            : isListening
            ? '聞いています... (クリックで停止)'
            : 'クリックして話しかける'
          }
        </div>
      </div>

      {/* 音声認識結果表示 */}
      {(currentTranscript || finalText) && (
        <div className="bg-gray-50 rounded-lg p-3 mb-2">
          <div className="text-xs text-gray-500 mb-1">認識された音声:</div>

          {/* 確定したテキスト */}
          {finalText && (
            <div className="text-sm text-gray-800 font-medium mb-1">
              「{finalText}」
            </div>
          )}

          {/* 現在認識中のテキスト */}
          {currentTranscript && !finalText && (
            <div className="text-sm text-gray-600 opacity-75">
              {currentTranscript}
              <span className="animate-pulse">|</span>
            </div>
          )}
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
          <div className="text-xs text-red-600">{error}</div>
          {error.includes('許可') && (
            <button
              onClick={checkPermission}
              className="text-xs text-red-600 underline mt-1 hover:text-red-700"
            >
              マイク許可を再試行
            </button>
          )}
        </div>
      )}

      {/* 使い方ヒント */}
      {!isListening && !error && (
        <div className="text-xs text-gray-400 space-y-1">
          <div>💡 ヒント:</div>
          <div>• 「こんにちは」「遊ぼ」「お腹すいた」など</div>
          <div>• はっきりと話してください</div>
          <div>• 静かな場所で使用すると効果的です</div>
        </div>
      )}
    </div>
  )
}