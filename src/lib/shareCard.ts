// 親密度達成カード生成システム
// Canvas API を使用して音声付きシェアカードを作成

export interface ShareCardData {
  intimacyLevel: number
  intimacyLevelName: string
  totalConversations: number
  uniqueDays: number
  consecutiveDays: number
  specialUnlocks: string[]
  relationshipMessage: string
  timestamp: Date
}

export interface ShareCardResult {
  imageBlob: Blob
  audioBlob?: Blob
  shareText: string
  cardId: string
}

// シェアカード画像を生成
export async function generateShareCard(
  cardData: ShareCardData,
  audioBlob?: Blob
): Promise<ShareCardResult> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas context not available')
  }

  // カードサイズ (Instagram正方形に最適化)
  canvas.width = 800
  canvas.height = 800

  // 背景グラデーション
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, '#FEF3C7') // amber-100
  gradient.addColorStop(1, '#FBBF24') // amber-400
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // メインカード背景
  const cardPadding = 60
  const cardWidth = canvas.width - (cardPadding * 2)
  const cardHeight = canvas.height - (cardPadding * 2)

  ctx.fillStyle = 'white'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 10
  roundedRect(ctx, cardPadding, cardPadding, cardWidth, cardHeight, 20)
  ctx.fill()
  ctx.shadowColor = 'transparent'

  // ヘッダー部分
  ctx.fillStyle = '#EA580C' // orange-600
  ctx.font = 'bold 36px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('🐼 親密度達成！', canvas.width / 2, cardPadding + 60)

  // 親密度レベル表示
  const intimacyColor = getIntimacyColor(cardData.intimacyLevel)
  ctx.fillStyle = intimacyColor
  ctx.font = 'bold 72px sans-serif'
  ctx.fillText(`${cardData.intimacyLevel}%`, canvas.width / 2, cardPadding + 160)

  // 関係性名
  ctx.fillStyle = '#9A3412' // orange-800
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText(cardData.intimacyLevelName, canvas.width / 2, cardPadding + 200)

  // アイコンとメッセージ
  const levelIcon = getIntimacyIcon(cardData.intimacyLevel)
  ctx.font = '48px sans-serif'
  ctx.fillText(levelIcon, canvas.width / 2, cardPadding + 280)

  // 関係性メッセージ
  ctx.fillStyle = '#374151' // gray-700
  ctx.font = '20px sans-serif'
  wrapText(ctx, cardData.relationshipMessage, canvas.width / 2, cardPadding + 320, cardWidth - 80, 28)

  // 統計情報
  const statsY = cardPadding + 400
  ctx.fillStyle = '#6B7280' // gray-500
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'left'

  const statsLeft = cardPadding + 60
  const statsRight = canvas.width - cardPadding - 60

  // 左側の統計
  ctx.fillText(`📊 総会話回数`, statsLeft, statsY)
  ctx.fillStyle = '#1F2937' // gray-800
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(`${cardData.totalConversations}回`, statsLeft, statsY + 30)

  ctx.fillStyle = '#6B7280'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText(`📅 ユニーク訪問日`, statsLeft, statsY + 80)
  ctx.fillStyle = '#1F2937'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(`${cardData.uniqueDays}日`, statsLeft, statsY + 110)

  // 右側の統計
  ctx.fillStyle = '#6B7280'
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`🔥 連続訪問日`, statsRight, statsY)
  ctx.fillStyle = '#1F2937'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(`${cardData.consecutiveDays}日`, statsRight, statsY + 30)

  // 特別解放の表示
  if (cardData.specialUnlocks.length > 0) {
    ctx.fillStyle = '#6B7280'
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText(`🏆 特別解放`, statsRight, statsY + 80)
    ctx.fillStyle = '#1F2937'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText(`${cardData.specialUnlocks.length}個`, statsRight, statsY + 110)
  }

  // 音声付きの表示
  if (audioBlob) {
    ctx.fillStyle = '#DC2626' // red-600
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🔊 この成果には特別な鳴き声が付いています', canvas.width / 2, cardPadding + 580)
  }

  // フッター
  ctx.fillStyle = '#9CA3AF' // gray-400
  ctx.font = '14px sans-serif'
  ctx.fillText('🐾 西山動物園 レッサーパンダトーク', canvas.width / 2, cardPadding + 620)

  // タイムスタンプ
  const dateStr = cardData.timestamp.toLocaleDateString('ja-JP')
  ctx.fillText(dateStr, canvas.width / 2, cardPadding + 650)

  // Canvas を Blob に変換
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate image blob'))
          return
        }

        const cardId = generateCardId(cardData)
        const shareText = generateShareText(cardData)

        resolve({
          imageBlob: blob,
          audioBlob,
          shareText,
          cardId
        })
      },
      'image/png',
      0.95
    )
  })
}

// 角丸四角形を描画
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

// テキストを指定幅で改行
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split('')
  let line = ''
  let currentY = y

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i]
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x, currentY)
      line = words[i]
      currentY += lineHeight
    } else {
      line = testLine
    }
  }

  if (line) {
    ctx.fillText(line, x, currentY)
  }
}

// 親密度に応じた色を取得
function getIntimacyColor(intimacyLevel: number): string {
  if (intimacyLevel >= 80) return '#EC4899' // pink-500
  if (intimacyLevel >= 60) return '#8B5CF6' // purple-500
  if (intimacyLevel >= 40) return '#3B82F6' // blue-500
  if (intimacyLevel >= 20) return '#10B981' // green-500
  if (intimacyLevel >= 5) return '#F59E0B' // yellow-500
  return '#6B7280' // gray-500
}

// 親密度に応じたアイコンを取得
function getIntimacyIcon(intimacyLevel: number): string {
  if (intimacyLevel >= 80) return '💕'
  if (intimacyLevel >= 60) return '🌟'
  if (intimacyLevel >= 40) return '😊'
  if (intimacyLevel >= 20) return '🌱'
  if (intimacyLevel >= 5) return '👋'
  return '🐾'
}

// シェア用テキストを生成
function generateShareText(cardData: ShareCardData): string {
  const achievements = []

  if (cardData.intimacyLevel >= 80) {
    achievements.push('親友レベル達成！')
  } else if (cardData.intimacyLevel >= 60) {
    achievements.push('友達レベル達成！')
  } else if (cardData.intimacyLevel >= 40) {
    achievements.push('知り合いレベル達成！')
  }

  if (cardData.consecutiveDays >= 7) {
    achievements.push('1週間連続訪問！')
  } else if (cardData.consecutiveDays >= 3) {
    achievements.push('3日連続訪問！')
  }

  if (cardData.totalConversations >= 50) {
    achievements.push('会話マスター！')
  } else if (cardData.totalConversations >= 20) {
    achievements.push('おしゃべり好き！')
  }

  const achievementText = achievements.length > 0
    ? achievements.join(' ') + ' '
    : ''

  return `🐼 レッサーパンダとの親密度${cardData.intimacyLevel}%を達成！${achievementText}

${cardData.relationshipMessage}

#西山動物園 #レッサーパンダ #どうぶつトーク #親密度${cardData.intimacyLevel}% #動物園デジタル体験`
}

// カードIDを生成
function generateCardId(cardData: ShareCardData): string {
  const timestamp = cardData.timestamp.getTime().toString(36)
  const level = cardData.intimacyLevel.toString(36)
  const conversations = cardData.totalConversations.toString(36)
  return `panda-${level}-${conversations}-${timestamp}`
}

// シェアカードの一時URLを生成
export function createShareUrl(cardResult: ShareCardResult): Promise<{
  imageUrl: string
  audioUrl?: string
  sharePageUrl: string
}> {
  return new Promise((resolve) => {
    const imageUrl = URL.createObjectURL(cardResult.imageBlob)
    const audioUrl = cardResult.audioBlob
      ? URL.createObjectURL(cardResult.audioBlob)
      : undefined

    // シェア用のページURL（実装時はドメインを適切に設定）
    const sharePageUrl = `${window.location.origin}/share/${cardResult.cardId}`

    resolve({
      imageUrl,
      audioUrl,
      sharePageUrl
    })
  })
}

// Web Share API でネイティブシェア
export async function shareCard(cardResult: ShareCardResult): Promise<void> {
  if (!navigator.share) {
    throw new Error('Web Share API not supported')
  }

  const files = [
    new File([cardResult.imageBlob], `panda-intimacy-${cardResult.cardId}.png`, {
      type: 'image/png'
    })
  ]

  if (cardResult.audioBlob) {
    files.push(
      new File([cardResult.audioBlob], `panda-voice-${cardResult.cardId}.webm`, {
        type: 'audio/webm'
      })
    )
  }

  try {
    await navigator.share({
      title: '🐼 レッサーパンダとの親密度達成！',
      text: cardResult.shareText,
      files
    })
  } catch (error) {
    // ファイルシェアが失敗した場合はテキストのみでシェア
    if (error instanceof Error && error.name === 'NotAllowedError') {
      await navigator.share({
        title: '🐼 レッサーパンダとの親密度達成！',
        text: cardResult.shareText
      })
    } else {
      throw error
    }
  }
}

// Twitter 専用シェアURL生成
export function generateTwitterShareUrl(cardResult: ShareCardResult): string {
  const text = encodeURIComponent(cardResult.shareText)
  const url = encodeURIComponent(`${window.location.origin}/share/${cardResult.cardId}`)
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
}

// LINE 専用シェアURL生成
export function generateLineShareUrl(cardResult: ShareCardResult): string {
  const text = encodeURIComponent(cardResult.shareText)
  return `https://line.me/R/msg/text/?${text}`
}