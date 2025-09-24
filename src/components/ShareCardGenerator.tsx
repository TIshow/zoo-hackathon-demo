import { useState, useCallback } from 'react'
import { generateShareCard, shareCard, generateTwitterShareUrl, generateLineShareUrl, createShareUrl, type ShareCardData, type ShareCardResult } from '@/lib/shareCard'
import { recordPandaSpeech, type RecordingResult } from '@/lib/audioRecording'

interface ShareCardGeneratorProps {
  cardData: ShareCardData
  audioContext: AudioContext | null
  onClose: () => void
}

export default function ShareCardGenerator({ cardData, audioContext, onClose }: ShareCardGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [shareResult, setShareResult] = useState<ShareCardResult | null>(null)
  const [shareUrls, setShareUrls] = useState<{
    imageUrl: string
    audioUrl?: string
    sharePageUrl: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [includeAudio, setIncludeAudio] = useState(true)

  const handleGenerateCard = useCallback(async () => {
    if (isGenerating) return

    setIsGenerating(true)
    setError(null)

    try {
      let audioBlob: Blob | undefined

      // 音声録音（チェックボックスがONの場合）
      if (includeAudio && audioContext) {
        try {
          // 親密度に応じたランダムな音声を録音
          const speechParams = {
            grainCount: Math.max(2, Math.floor((cardData.intimacyLevel / 100) * 4) + 2),
            pitchVariation: Math.max(1, (cardData.intimacyLevel / 100) * 3),
            useReverb: cardData.intimacyLevel >= 30
          }

          // パンダ音声ファイル（最初のものを使用）
          const audioUrl = '/sounds/panda1.mp3'

          const recordingResult: RecordingResult = await recordPandaSpeech(
            audioContext,
            audioUrl,
            speechParams
          )

          audioBlob = recordingResult.audioBlob
        } catch (audioError) {
          console.warn('Audio recording failed, generating card without audio:', audioError)
          audioBlob = undefined
        }
      }

      // シェアカード生成
      const result = await generateShareCard(cardData, audioBlob)
      setShareResult(result)

      // URL生成
      const urls = await createShareUrl(result)
      setShareUrls(urls)

    } catch (err) {
      console.error('Share card generation failed:', err)
      setError(err instanceof Error ? err.message : 'カード生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }, [cardData, audioContext, includeAudio, isGenerating])

  const handleNativeShare = useCallback(async () => {
    if (!shareResult) return

    try {
      await shareCard(shareResult)
    } catch (err) {
      console.error('Native share failed:', err)
      setError('シェアに失敗しました。ブラウザが対応していない可能性があります。')
    }
  }, [shareResult])

  const handleDownloadImage = useCallback(() => {
    if (!shareUrls) return

    const link = document.createElement('a')
    link.href = shareUrls.imageUrl
    link.download = `panda-intimacy-card-${cardData.intimacyLevel}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [shareUrls, cardData.intimacyLevel])

  const handleDownloadAudio = useCallback(() => {
    if (!shareUrls?.audioUrl) return

    const link = document.createElement('a')
    link.href = shareUrls.audioUrl
    link.download = `panda-voice-${cardData.intimacyLevel}.webm`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [shareUrls, cardData.intimacyLevel])

  const handleCopyText = useCallback(async () => {
    if (!shareResult) return

    try {
      await navigator.clipboard.writeText(shareResult.shareText)
      // 簡易的なフィードバック表示
      const button = document.getElementById('copy-text-button')
      if (button) {
        const originalText = button.textContent
        button.textContent = 'コピー完了！'
        setTimeout(() => {
          button.textContent = originalText
        }, 2000)
      }
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }, [shareResult])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-orange-900">
              🎉 親密度達成カード
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="閉じる"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            親密度{cardData.intimacyLevel}%達成を記念してシェアカードを作成しましょう！
          </p>
        </div>

        <div className="p-6">
          {!shareResult ? (
            <div className="space-y-4">
              {/* 音声オプション */}
              <div className="bg-blue-50 rounded-lg p-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-300"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      🔊 特別な鳴き声を録音して追加
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      現在の親密度レベルに応じたパンダの声を自動生成して添付します
                    </p>
                  </div>
                </label>
              </div>

              {/* カード情報プレビュー */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="text-sm text-gray-600">カード内容プレビュー:</div>
                <div className="text-lg font-bold text-orange-900">
                  親密度 {cardData.intimacyLevel}% ({cardData.intimacyLevelName})
                </div>
                <div className="text-sm text-gray-700">
                  {cardData.relationshipMessage}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>📊 {cardData.totalConversations}回会話</div>
                  <div>📅 {cardData.uniqueDays}日訪問</div>
                  <div>🔥 {cardData.consecutiveDays}日連続</div>
                  <div>🏆 {cardData.specialUnlocks.length}個解放</div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-sm text-red-600">{error}</div>
                </div>
              )}

              {/* 生成ボタン */}
              <button
                onClick={handleGenerateCard}
                disabled={isGenerating || !audioContext}
                className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-orange-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                    </svg>
                    <span>
                      {includeAudio ? '録音中...' : '生成中...'}
                    </span>
                  </span>
                ) : (
                  'シェアカードを作成'
                )}
              </button>

              {!audioContext && (
                <div className="text-xs text-yellow-600 bg-yellow-50 rounded-lg p-3">
                  ⚠️ 音声機能を使用するには、まず一度パンダと会話してください
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 生成されたカードプレビュー */}
              {shareUrls && (
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shareUrls.imageUrl}
                    alt="親密度達成カード"
                    className="w-full max-w-xs mx-auto rounded-lg shadow-lg"
                  />
                  {shareUrls.audioUrl && (
                    <div className="mt-2">
                      <audio controls className="w-full max-w-xs">
                        <source src={shareUrls.audioUrl} type="audio/webm" />
                        <source src={shareUrls.audioUrl} type="audio/wav" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              )}

              {/* シェアオプション */}
              <div className="space-y-2">
                {/* ネイティブシェア */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={handleNativeShare}
                    className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
                  >
                    📱 この端末でシェア
                  </button>
                )}

                {/* SNSシェア */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={generateTwitterShareUrl(shareResult)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition text-center text-sm"
                  >
                    🐦 Twitter
                  </a>
                  <a
                    href={generateLineShareUrl(shareResult)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition text-center text-sm"
                  >
                    💬 LINE
                  </a>
                </div>

                {/* ダウンロード */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadImage}
                    className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition text-sm"
                  >
                    🖼️ 画像保存
                  </button>
                  {shareUrls?.audioUrl && (
                    <button
                      onClick={handleDownloadAudio}
                      className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition text-sm"
                    >
                      🔊 音声保存
                    </button>
                  )}
                </div>

                {/* テキストコピー */}
                <button
                  id="copy-text-button"
                  onClick={handleCopyText}
                  className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition text-sm"
                >
                  📋 シェア文をコピー
                </button>
              </div>

              {/* シェアテキストプレビュー */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-1">シェア用テキスト:</div>
                <div className="text-xs text-gray-800 whitespace-pre-line">
                  {shareResult.shareText}
                </div>
              </div>

              {/* 新しいカード作成 */}
              <button
                onClick={() => {
                  setShareResult(null)
                  setShareUrls(null)
                  setError(null)
                }}
                className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition text-sm"
              >
                🎨 別のカードを作成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}