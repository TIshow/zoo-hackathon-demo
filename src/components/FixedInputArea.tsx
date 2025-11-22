import { useState } from 'react'
import VoiceInput from '@/components/VoiceInput'
import QuickChips from '@/components/QuickChips'

interface FixedInputAreaProps {
  userInput: string
  setUserInput: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  onQuickQuestion: (question: string) => void
  onVoiceInput: (text: string) => void
  isDisabled: boolean
  isThinking: boolean
  isSpeaking: boolean
}

export default function FixedInputArea({
  userInput,
  setUserInput,
  onSubmit,
  onQuickQuestion,
  onVoiceInput,
  isDisabled,
  isThinking,
  isSpeaking
}: FixedInputAreaProps) {
  const [showQuickChips, setShowQuickChips] = useState(true)

  return (
    <div className="border-t border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-lg mx-auto p-4 space-y-3">
        {/* よく使う質問（折りたたみ可能） */}
        {showQuickChips && (
          <div className="animate-in slide-in-from-bottom-2">
            <QuickChips
              onQuickQuestion={(question) => {
                onQuickQuestion(question)
                setShowQuickChips(false) // 使用後は隠す
              }}
              disabled={isDisabled}
            />
          </div>
        )}

        {/* 入力エリア */}
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200">
          <div className="space-y-3">
            {/* テキスト入力 */}
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="レッサーパンダに話しかけてね！"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 disabled:bg-gray-50 transition-all duration-200 placeholder-gray-400"
                  disabled={isDisabled}
                  aria-label="レッサーパンダへのメッセージ入力"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!userInput.trim() || isDisabled}
                  className="flex-1 bg-brand-gradient bg-brand-gradient-hover text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:scale-100 focus:ring-2 focus:ring-orange-400 focus:outline-none font-medium"
                  aria-label="メッセージを送信してレッサーパンダに話しかける"
                >
                  {isThinking ? '🤔 考え中...' : isSpeaking ? '🗣️ 鳴いています...' : '💬 話しかける'}
                </button>

                {/* クイックチップス表示切り替えボタン */}
                {!showQuickChips && (
                  <button
                    type="button"
                    onClick={() => setShowQuickChips(true)}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                    aria-label="よく使う質問を表示"
                  >
                    💡
                  </button>
                )}
              </div>
            </form>

            {/* 音声入力（コンパクト版） */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center gap-2 py-2">
                <span>🎤</span>
                音声で話しかける
                <span className="group-open:rotate-90 transition-transform">▶</span>
              </summary>
              <div className="mt-2">
                <VoiceInput
                  onVoiceInput={onVoiceInput}
                  disabled={isDisabled}
                  isProcessing={isSpeaking || isThinking}
                />
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  )
}