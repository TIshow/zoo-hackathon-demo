import { useEffect, useRef } from 'react'
import type { PandaReply } from '@/data/replies'
import type { IntentResult, GrainTimeline, AnalyserBridge } from '@/types/audio'
import dynamic from 'next/dynamic'

// CSR専用コンポーネント
const SpectrumPanel = dynamic(() => import('@/components/SpectrumPanel'), { ssr: false })
const TranslationCaption = dynamic(() => import('@/components/TranslationCaption'), { ssr: false })

interface ChatMessage {
  id: string
  type: 'user' | 'panda'
  content: string
  timestamp: Date
  reply?: PandaReply
  analysisData?: {
    intentResult: IntentResult | null
    pandaSound: string
    translation: string
    grainTimeline: GrainTimeline[]
  }
}

interface ChatHistoryProps {
  messages: ChatMessage[]
  isAnalysisEnabled: boolean
  analyserBridge: AnalyserBridge | null
  isAnalyzing: boolean
}

export default function ChatHistory({
  messages,
  isAnalysisEnabled,
  analyserBridge,
  isAnalyzing
}: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🐼</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            レッサーパンダと会話しよう！
          </h2>
          <p className="text-gray-500 text-sm">
            下のメッセージ欄から話しかけてみてね
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="space-y-3">
          {/* ユーザーメッセージ */}
          {message.type === 'user' && (
            <div className="flex justify-end">
              <div className="max-w-xs lg:max-w-md">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-2xl rounded-tr-sm">
                  {message.content}
                </div>
                <div className="text-xs text-gray-400 text-right mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )}

          {/* パンダメッセージ */}
          {message.type === 'panda' && (
            <div className="flex justify-start">
              <div className="max-w-xs lg:max-w-md">
                <div className="flex items-start gap-2">
                  <div className="text-2xl">🐼</div>
                  <div className="flex-1">
                    <div className="bg-white border border-gray-200 px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm">
                      {message.reply?.translation || message.content}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* 解析結果（折りたたみ可能） */}
                {isAnalysisEnabled && message.analysisData && (
                  <div className="mt-3 ml-8 space-y-2">
                    {/* スペクトラム解析 */}
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1">
                        <span className="text-xs">📊</span>
                        音声解析結果
                        <span className="ml-1 group-open:rotate-90 transition-transform">▶</span>
                      </summary>
                      <div className="mt-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
                        <SpectrumPanel
                          analyserBridge={analyserBridge}
                          isActive={false}
                          className="h-20 rounded-lg overflow-hidden mb-2"
                        />
                        <TranslationCaption
                          intentResult={message.analysisData.intentResult}
                          pandaSound={message.analysisData.pandaSound}
                          translation={message.analysisData.translation}
                          grainTimeline={message.analysisData.grainTimeline}
                          isActive={false}
                          className="min-h-[60px]"
                        />
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 現在進行中の解析表示 */}
      {isAnalyzing && (
        <div className="flex justify-start">
          <div className="max-w-xs lg:max-w-md">
            <div className="flex items-start gap-2">
              <div className="text-2xl">🐼</div>
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-orange-300 border-t-orange-600 rounded-full"></div>
                  <span className="text-sm text-gray-600">解析中...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}

export type { ChatMessage }