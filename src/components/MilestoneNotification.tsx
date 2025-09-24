import { useEffect, useState, useCallback } from 'react'

interface Milestone {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
}

interface MilestoneNotificationProps {
  newUnlocks: string[]
  onClose: () => void
}

export default function MilestoneNotification({ newUnlocks, onClose }: MilestoneNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  const milestoneData: Record<string, Milestone> = {
    chatty_friend: {
      id: 'chatty_friend',
      title: 'おしゃべり好き',
      description: '10回会話したよ！話すのが楽しいね♪',
      icon: '💬',
      unlocked: true
    },
    close_buddy: {
      id: 'close_buddy',
      title: '親密な友達',
      description: '親密度50%到達！もう友達だね～',
      icon: '🤝',
      unlocked: true
    },
    regular_visitor: {
      id: 'regular_visitor',
      title: '常連さん',
      description: '3日連続で来てくれた！嬉しいな♪',
      icon: '🎯',
      unlocked: true
    },
    weekly_friend: {
      id: 'weekly_friend',
      title: '1週間の友',
      description: '7日間も会いに来てくれてありがとう！',
      icon: '📅',
      unlocked: true
    },
    // 追加のマイルストーン
    early_bird: {
      id: 'early_bird',
      title: '朝の友達',
      description: '朝早くから会いに来てくれるんだね！',
      icon: '🌅',
      unlocked: true
    },
    night_owl: {
      id: 'night_owl',
      title: '夜ふかし友達',
      description: '夜遅くまでお疲れさま！',
      icon: '🌙',
      unlocked: true
    },
    long_talker: {
      id: 'long_talker',
      title: 'おしゃべり上手',
      description: '長時間お話ししてくれてありがとう♪',
      icon: '⏰',
      unlocked: true
    }
  }

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 300) // アニメーション完了後にコールバック
  }, [onClose])

  useEffect(() => {
    if (newUnlocks.length > 0) {
      setIsVisible(true)
      // 5秒後に自動で閉じる
      const timer = setTimeout(() => {
        handleClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [newUnlocks, handleClose])

  if (newUnlocks.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isVisible ? 'bg-opacity-50' : 'bg-opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* 通知カード */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all duration-500 ${
          isVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-8 scale-95 opacity-0'
        }`}
      >
        {/* ヘッダー */}
        <div className="text-center mb-4">
          <div className="text-3xl mb-2">🎉</div>
          <h3 className="text-lg font-bold text-orange-900 mb-1">
            マイルストーン達成！
          </h3>
          <p className="text-sm text-gray-600">
            新しい実績を解放しました
          </p>
        </div>

        {/* マイルストーン一覧 */}
        <div className="space-y-3 mb-4">
          {newUnlocks.map(unlockId => {
            const milestone = milestoneData[unlockId]
            if (!milestone) return null

            return (
              <div
                key={unlockId}
                className="flex items-center space-x-3 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200"
              >
                <div className="text-2xl animate-bounce">
                  {milestone.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-900 text-sm">
                    {milestone.title}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    {milestone.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* 効果説明 */}
        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <div className="text-xs text-blue-800 space-y-1">
            <div className="font-medium">🎵 特別効果が解放されました！</div>
            <div>• より表現豊かな鳴き声</div>
            <div>• 親密度ボーナス</div>
            <div>• レアなセリフが出現</div>
          </div>
        </div>

        {/* 閉じるボタン */}
        <div className="text-center">
          <button
            onClick={handleClose}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            続ける
          </button>
        </div>

        {/* 自動閉じるタイマー表示 */}
        <div className="absolute top-2 right-2">
          <div className="w-8 h-8 relative">
            <svg className="w-8 h-8 transform -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-gray-200"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 14}`}
                strokeDashoffset={`${2 * Math.PI * 14}`}
                className="text-orange-400 animate-pulse"
                style={{
                  animation: 'countdown 5s linear forwards'
                }}
              />
            </svg>
            <button
              onClick={handleClose}
              className="absolute inset-0 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="閉じる"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* カスタムアニメーション */}
      <style jsx>{`
        @keyframes countdown {
          from {
            stroke-dashoffset: ${2 * Math.PI * 14};
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  )
}