
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { selectPandaReply, type PandaReply } from '@/data/replies'
import {
  speakLikePanda,
  initializeAudioContext,
  createVariedSpeechParams
} from '@/lib/pandaSpeech'
import Bubble from '@/components/Bubble'
import QuickChips from '@/components/QuickChips'

export default function Home() {
  const [userInput, setUserInput] = useState('')
  const [currentReply, setCurrentReply] = useState<PandaReply | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)

  const autoSpeakTimer = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // 音声発話処理
  const performSpeech = useCallback(async (input: string, isUserInput: boolean = true) => {
    if (isSpeaking) return

    try {
      // 考え中状態を表示（250ms）
      setIsThinking(true)
      await new Promise(resolve => setTimeout(resolve, 250))
      setIsThinking(false)

      setIsSpeaking(true)

      // 返答を選択
      const reply = selectPandaReply(input)

      // AudioContextの初期化
      if (!audioContextRef.current) {
        audioContextRef.current = await initializeAudioContext()
        setAudioInitialized(true)
      }

      // 意図に応じたパラメータを生成
      let intent: 'greeting' | 'hungry' | 'playful' | 'random' = 'random'
      if (reply.id === 1) intent = 'hungry'
      else if (reply.id === 2) intent = 'playful'
      else if (reply.id === 3) intent = 'greeting'

      const speechParams = createVariedSpeechParams(intent)

      // 粒合成による音声再生
      await speakLikePanda(audioContextRef.current, reply.src, speechParams)

      // 翻訳表示
      setCurrentReply(reply)
      if (isUserInput) {
        setUserInput('')
      }

      // 音声の長さを推定して発話終了を管理
      const estimatedDuration = (speechParams.grainCount || 3) * 0.5 + 1
      setTimeout(() => {
        setIsSpeaking(false)
      }, estimatedDuration * 1000)

    } catch (error) {
      console.error('Speech synthesis failed:', error)
      setIsSpeaking(false)
    }
  }, [isSpeaking])

  // 自動発話処理
  const handleAutoSpeak = useCallback(async () => {
    if (isSpeaking) return

    const randomInput = ['おまかせで鳴く', 'こんにちは', 'あそぼ'][Math.floor(Math.random() * 3)]
    await performSpeech(randomInput, false)
  }, [isSpeaking, performSpeech])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (autoSpeakTimer.current) {
        clearTimeout(autoSpeakTimer.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // 自動発話制御
  useEffect(() => {
    if (autoSpeakEnabled && audioInitialized && !isSpeaking) {
      const scheduleNext = () => {
        const delay = Math.random() * 10000 + 10000 // 10-20秒
        autoSpeakTimer.current = setTimeout(async () => {
          if (autoSpeakEnabled && !isSpeaking) {
            await handleAutoSpeak()
          }
          if (autoSpeakEnabled) scheduleNext()
        }, delay)
      }
      scheduleNext()
    } else if (autoSpeakTimer.current) {
      clearTimeout(autoSpeakTimer.current)
      autoSpeakTimer.current = null
    }

    return () => {
      if (autoSpeakTimer.current) {
        clearTimeout(autoSpeakTimer.current)
        autoSpeakTimer.current = null
      }
    }
  }, [autoSpeakEnabled, audioInitialized, isSpeaking, handleAutoSpeak])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userInput.trim() && !isSpeaking) {
      await performSpeech(userInput.trim())
    }
  }

  const handleQuickQuestion = async (question: string) => {
    if (!isSpeaking) {
      await performSpeech(question)
    }
  }

  const toggleAutoSpeak = () => {
    setAutoSpeakEnabled(!autoSpeakEnabled)
  }

  const isDisabled = isSpeaking || isThinking

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200">
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-6">
          {/* ヘッダー */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-orange-900 mb-2">
              🐼 どうぶつトーク！Nishiyama Edition
            </h1>
            <p className="text-sm text-gray-600 mb-1">
              レッサーパンダと&quot;おしゃべり&quot;（模擬翻訳）
            </p>
            <p className="text-xs text-orange-600 font-medium">
              🔊 音量にご注意ください
            </p>
          </div>

          {/* 入力フォーム */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="レッサーパンダに話しかけてね..."
                className="w-full px-4 py-3 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent disabled:bg-gray-50"
                disabled={isDisabled}
                aria-label="レッサーパンダへのメッセージ入力"
              />
            </div>
            <button
              type="submit"
              disabled={!userInput.trim() || isDisabled}
              className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed focus:ring-2 focus:ring-orange-300 focus:outline-none"
              aria-label="メッセージを送信してレッサーパンダに話しかける"
            >
              {isThinking ? '考え中...' : isSpeaking ? '鳴いています...' : '話しかける'}
            </button>
          </form>

          {/* プリセット質問 */}
          <QuickChips
            onQuickQuestion={handleQuickQuestion}
            disabled={isDisabled}
          />

          {/* 自動発話トグル */}
          <div className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSpeakEnabled}
                onChange={toggleAutoSpeak}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-300"
                aria-describedby="auto-speak-description"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  🧪 実験：パンダが&quot;自由にしゃべる&quot;
                </span>
                <p id="auto-speak-description" className="text-xs text-gray-500 mt-1">
                  10〜20秒ごとに自動で鳴きます（初回操作後に有効）
                </p>
              </div>
            </label>
          </div>

          {/* 返答吹き出し */}
          <Bubble
            translation={currentReply?.translation || ''}
            isVisible={!!currentReply}
          />
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-orange-50 border-t border-orange-200 p-4 text-center text-xs text-gray-600">
        <p className="mb-1">
          ※ この翻訳は擬似的な演出です。実際の鳴き声の意味を保証するものではありません。
        </p>
        <p>
          園内限定の&quot;特別ボイス&quot;も準備中！西山動物園で会いに来てね🐾
        </p>
      </footer>
    </div>
  )
}
