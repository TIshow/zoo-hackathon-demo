'use client'

import { useEffect, useState } from 'react'

interface IntimacyGaugeProps {
  intimacyLevel: number
  totalConversations: number
  relationshipName: string
  message: string
  isAnimating?: boolean
  onShareCard?: () => void
  compact?: boolean
}

export default function IntimacyGaugeClient({
  intimacyLevel,
  totalConversations,
  relationshipName,
  message,
  isAnimating = false,
  onShareCard,
  compact = false
}: IntimacyGaugeProps) {
  const [displayLevel, setDisplayLevel] = useState(0)
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [previousIntimacyLevel, setPreviousIntimacyLevel] = useState(0)
  const [isMounted, setIsMounted] = useState(false)

  // マウント検知
  useEffect(() => {
    setIsMounted(true)
    setDisplayLevel(intimacyLevel)
    setPreviousIntimacyLevel(intimacyLevel)
  }, [intimacyLevel])

  // 親密度アニメーション
  useEffect(() => {
    if (!isMounted) return

    if (intimacyLevel > displayLevel) {
      const timer = setTimeout(() => {
        setDisplayLevel(prev => Math.min(prev + 1, intimacyLevel))
      }, 20)
      return () => clearTimeout(timer)
    }
  }, [intimacyLevel, displayLevel, isMounted])

  // レベルアップ演出
  useEffect(() => {
    if (!isMounted) return

    if (intimacyLevel > previousIntimacyLevel && intimacyLevel > 0) {
      setShowLevelUp(true)
      const timer = setTimeout(() => {
        setShowLevelUp(false)
      }, 2000)
      setPreviousIntimacyLevel(intimacyLevel)
      return () => clearTimeout(timer)
    }
  }, [intimacyLevel, previousIntimacyLevel, isMounted])

  // isAnimatingプロパティによる制御
  useEffect(() => {
    if (!isAnimating && showLevelUp) {
      setShowLevelUp(false)
    }
  }, [isAnimating, showLevelUp])

  // 親密度レベルに応じた色とアイコン
  const getLevelStyle = (level: number) => {
    if (level >= 80) return { color: 'text-pink-600', bg: 'bg-pink-500', icon: '💕' }
    if (level >= 60) return { color: 'text-purple-600', bg: 'bg-purple-500', icon: '🌟' }
    if (level >= 40) return { color: 'text-blue-600', bg: 'bg-blue-500', icon: '😊' }
    if (level >= 20) return { color: 'text-green-600', bg: 'bg-green-500', icon: '🌱' }
    if (level >= 5) return { color: 'text-yellow-600', bg: 'bg-yellow-500', icon: '👋' }
    return { color: 'text-gray-600', bg: 'bg-gray-400', icon: '🐾' }
  }

  // マウント前は何も表示しない（SSRスキップ）
  if (!isMounted) {
    return (
      <div className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm h-64 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <div>
              <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
          <div className="text-right">
            <div className="h-6 bg-gray-200 rounded w-12 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-10"></div>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
      </div>
    )
  }

  const style = getLevelStyle(displayLevel)
  const nextThreshold = getNextThreshold(displayLevel)

  if (compact) {
    return (
      <div className="relative">
        {/* レベルアップ演出 */}
        {showLevelUp && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-90 rounded">
            <div className="text-center animate-bounce">
              <div className="text-lg mb-1">🎉</div>
              <div className="text-xs font-bold text-orange-600">
                レベルアップ！
              </div>
            </div>
          </div>
        )}

        {/* コンパクトヘッダー */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm">{style.icon}</span>
            <div>
              <h3 className={`font-medium text-xs ${style.color}`}>
                {relationshipName}
              </h3>
              <p className="text-xs text-gray-500">
                {totalConversations}回
              </p>
            </div>
          </div>
          <div className={`text-right ${style.color}`}>
            <div className="text-sm font-bold">
              {displayLevel}%
            </div>
          </div>
        </div>

        {/* コンパクトプログレスバー */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className={`h-2 ${style.bg} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${displayLevel}%` }}
          />
        </div>

        {/* コンパクト共有ボタン */}
        {onShareCard && (
          <div className="flex justify-center">
            <button
              onClick={onShareCard}
              className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 px-2 py-1 rounded-full border border-orange-200 hover:border-orange-300 transition-colors flex items-center gap-1"
            >
              <span>📤</span>
              <span>共有</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
      {/* レベルアップ演出 */}
      {showLevelUp && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-90 rounded-lg">
          <div className="text-center animate-bounce">
            <div className="text-2xl mb-2">🎉</div>
            <div className="text-sm font-bold text-orange-600">
              親密度レベルアップ！
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{style.icon}</span>
          <div>
            <h3 className={`font-medium text-sm ${style.color}`}>
              {relationshipName}
            </h3>
            <p className="text-xs text-gray-500">
              会話回数: {totalConversations}回
            </p>
          </div>
        </div>
        <div className={`text-right ${style.color}`}>
          <div className="text-lg font-bold">
            {displayLevel}%
          </div>
          <div className="text-xs text-gray-500">
            親密度
          </div>
        </div>
      </div>

      {/* プログレスバー */}
      <div className="relative">
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 ${style.bg} rounded-full transition-all duration-500 ease-out relative overflow-hidden`}
            style={{ width: `${displayLevel}%` }}
          >
            {/* シャイン効果 */}
            {isAnimating && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
            )}
          </div>
        </div>

        {/* 区切り線（20%ごと） */}
        <div className="absolute top-0 w-full h-3 flex justify-between items-center pointer-events-none">
          {[20, 40, 60, 80].map(threshold => (
            <div
              key={threshold}
              className="w-0.5 h-full bg-white opacity-50"
              style={{ marginLeft: threshold === 20 ? `${threshold-1}%` : 0 }}
            />
          ))}
        </div>
      </div>

      {/* メッセージ */}
      <div className="text-xs text-gray-600 text-center mb-2">
        {message}
      </div>

      {/* 次の目標 */}
      {nextThreshold && (
        <div className="text-xs text-gray-500 text-center">
          次の段階まであと {nextThreshold - displayLevel}%
          <span className="ml-1">
            ({getNextThresholdName(nextThreshold)})
          </span>
        </div>
      )}

      {/* ミニ統計 */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <div>
            <div className="font-medium text-gray-700">
              {Math.floor(totalConversations / 7) || 0}
            </div>
            <div className="text-gray-500">週平均</div>
          </div>
          <div>
            <div className="font-medium text-gray-700">
              {displayLevel >= 40 ? '🔓' : '🔒'}
            </div>
            <div className="text-gray-500">特別ボイス</div>
          </div>
          <div>
            <div className="font-medium text-gray-700">
              {getLevelBadge(displayLevel)}
            </div>
            <div className="text-gray-500">バッジ</div>
          </div>
        </div>
      </div>

      {/* シェアカードボタン */}
      {displayLevel >= 20 && onShareCard && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={onShareCard}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-md"
          >
            🎉 達成カードを作成・シェア
          </button>
          <p className="text-xs text-gray-500 text-center mt-1">
            親密度の記録を友達とシェアしよう！
          </p>
        </div>
      )}
    </div>
  )
}

// 次の閾値を取得
function getNextThreshold(currentLevel: number): number | null {
  const thresholds = [5, 20, 40, 60, 80, 100]
  return thresholds.find(threshold => threshold > currentLevel) || null
}

// 次の閾値の名前を取得
function getNextThresholdName(threshold: number): string {
  switch (threshold) {
    case 5: return '新顔'
    case 20: return '顔見知り'
    case 40: return '知り合い'
    case 60: return '友達'
    case 80: return '親友'
    case 100: return 'ベストフレンド'
    default: return '???'
  }
}

// レベルバッジを取得
function getLevelBadge(level: number): string {
  if (level >= 80) return '👑'
  if (level >= 60) return '⭐'
  if (level >= 40) return '🏅'
  if (level >= 20) return '🎖️'
  if (level >= 5) return '🏃'
  return '🌱'
}