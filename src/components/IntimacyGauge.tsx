import dynamic from 'next/dynamic'

// CSR専用でコンポーネントを読み込み、SSRを無効化
const IntimacyGaugeClient = dynamic(
  () => import('./IntimacyGaugeClient'),
  {
    ssr: false,
    loading: () => (
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
)

interface IntimacyGaugeProps {
  intimacyLevel: number
  totalConversations: number
  relationshipName: string
  message: string
  isAnimating?: boolean
  onShareCard?: () => void
  compact?: boolean
}

export default function IntimacyGauge(props: IntimacyGaugeProps) {
  return <IntimacyGaugeClient {...props} />
}