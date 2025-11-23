import { useState } from 'react'
import IntimacyGauge from '@/components/IntimacyGauge'
import type { PandaMemory } from '@/lib/pandaLearning'
import type { IntentResult, GrainTimeline } from '@/types/audio'
import dynamic from 'next/dynamic'

// CSR専用コンポーネント
const TranslationCaption = dynamic(() => import('@/components/TranslationCaption'), { ssr: false })

interface StatusPanelProps {
  pandaMemory: PandaMemory
  relationshipName: string
  intimacyMessage: string
  isAnimating: boolean
  onShareCard: () => void
  isClientMounted: boolean
  getMilestoneTitle: (id: string) => string
  latestAnalysisResult: {
    intentResult: IntentResult | null
    pandaSound: string
    translation: string
    grainTimeline: GrainTimeline[]
  } | null
  isAnalyzing: boolean
}

export default function StatusPanel({
  pandaMemory,
  relationshipName,
  intimacyMessage,
  isAnimating,
  onShareCard,
  isClientMounted,
  getMilestoneTitle,
  latestAnalysisResult,
  isAnalyzing
}: StatusPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="fixed top-20 right-4 z-50">
      {/* トグルボタン */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-white/90 backdrop-blur-sm shadow-lg rounded-full w-12 h-12 flex items-center justify-center border border-white/30 hover:bg-white transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        aria-label="ステータスパネルを開く"
      >
        <span className="text-xl">
          {isExpanded ? '✕' : '⚙️'}
        </span>
      </button>

      {/* 展開パネル */}
      {isExpanded && (
        <div className="mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-10rem)] bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/30 overflow-hidden flex flex-col animate-scale-in">
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* 親密度ゲージ */}
            <div className="border-b border-gray-200 pb-4">
              <IntimacyGauge
                intimacyLevel={pandaMemory.intimacyLevel}
                totalConversations={pandaMemory.totalConversations}
                relationshipName={relationshipName}
                message={intimacyMessage}
                isAnimating={isAnimating}
                onShareCard={onShareCard}
                compact={true}
              />
            </div>

            {/* AI翻訳結果表示 */}
            <div className="border-b border-gray-200 pb-4">
              <div className="mb-2">
                <h3 className="text-heading-sm text-gray-800 flex items-center gap-2">
                  <span className="text-lg">🗣️</span>
                  AI翻訳
                </h3>
              </div>

              {latestAnalysisResult ? (
                <TranslationCaption
                  intentResult={latestAnalysisResult.intentResult}
                  pandaSound={latestAnalysisResult.pandaSound}
                  translation={latestAnalysisResult.translation}
                  grainTimeline={latestAnalysisResult.grainTimeline}
                  isActive={isAnalyzing}
                  className="min-h-[60px] text-xs"
                />
              ) : (
                <div className="min-h-[60px] flex items-center justify-center text-caption border border-gray-200 rounded">
                  {isAnalyzing ? '解析中...' : '音声発話で解析結果が表示されます'}
                </div>
              )}
            </div>

            {/* 学習状況表示 */}
            {isClientMounted && pandaMemory.totalConversations > 0 && (
              <div>
                <div className="mb-2">
                  <h3 className="text-heading-sm text-gray-800 flex items-center gap-2">
                    <span className="text-lg">🧠</span>
                    学習状況
                  </h3>
                </div>
                <div className="space-y-2 text-body-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="w-5 text-center">🎨</span>
                    <span>スタイル: <span className="font-medium">{pandaMemory.preferredResponseStyle}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="w-5 text-center">📈</span>
                    <span>総会話: <span className="font-medium">{pandaMemory.totalConversations}回</span></span>
                  </div>
                  {pandaMemory.favoriteQuestions.length > 0 && (
                    <div className="flex items-start gap-2 text-gray-700">
                      <span className="w-5 text-center mt-0.5">❤️</span>
                      <span>人気: <span className="font-medium">{pandaMemory.favoriteQuestions[0].question}</span></span>
                    </div>
                  )}
                  {pandaMemory.specialUnlocks.length > 0 && (
                    <div className="flex items-start gap-2 text-gray-700">
                      <span className="w-5 text-center mt-0.5">🏆</span>
                      <span>解放: <span className="font-medium">{pandaMemory.specialUnlocks.slice(0, 2).map(id => getMilestoneTitle(id)).join(', ')}</span></span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}