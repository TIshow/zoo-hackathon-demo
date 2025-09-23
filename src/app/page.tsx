
'use client'

import { useState } from 'react'
import { selectPandaReply, type PandaReply } from '@/data/replies'
import Bubble from '@/components/Bubble'
import QuickChips from '@/components/QuickChips'

export default function Home() {
  const [userInput, setUserInput] = useState('')
  const [currentReply, setCurrentReply] = useState<PandaReply | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleTalk = (input: string) => {
    if (audio) {
      audio.pause()
    }

    const reply = selectPandaReply(input)
    const newAudio = new Audio(reply.src)

    setIsPlaying(true)
    newAudio.play()
    newAudio.onended = () => setIsPlaying(false)

    setAudio(newAudio)
    setCurrentReply(reply)
    setUserInput('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (userInput.trim()) {
      handleTalk(userInput.trim())
    }
  }

  const handleQuickQuestion = (question: string) => {
    handleTalk(question)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100">
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-orange-900 mb-2">🐼 レッサーパンダトーク</h1>
            <p className="text-sm text-gray-600">レッサーパンダと会話してみよう！</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="レッサーパンダに話しかけてね..."
                className="w-full px-4 py-3 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                disabled={isPlaying}
              />
            </div>
            <button
              type="submit"
              disabled={!userInput.trim() || isPlaying}
              className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isPlaying ? '鳴いています...' : '話しかける'}
            </button>
          </form>

          <QuickChips onQuickQuestion={handleQuickQuestion} />

          <Bubble
            translation={currentReply?.translation || ''}
            isVisible={!!currentReply}
          />
        </div>
      </main>

      <footer className="bg-orange-50 border-t border-orange-200 p-4 text-center text-xs text-gray-600">
        <p className="mb-1">⚠️ この翻訳は演出です。実際のレッサーパンダの声ではありません。</p>
        <p>🎵 園内限定の特別ボイス！ぜひ動物園にも遊びに来てくださいね</p>
      </footer>
    </div>
  )
}
