import { useState } from 'react'
import { ScannerView } from '../components/ScannerView'
import { ManualInput } from '../components/ManualInput'

type Tab = 'camera' | 'manual'

interface RecentItem {
  id: string
  title: string
}

interface Props {
  onScan: (bookId: string) => void
  recentScans: RecentItem[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export function ScanPage({ onScan, recentScans, loading, error, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('camera')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
        <h1 className="font-bold text-lg">📚 책정리 도우미</h1>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-white text-sm bg-blue-500 rounded-full px-3 py-1 active:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '로딩중...' : '🔄 새로고침'}
        </button>
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('camera')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'camera' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            📷 카메라 스캔
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            ⌨️ 번호 입력
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        {tab === 'camera' ? (
          <ScannerView onScan={onScan} />
        ) : (
          <ManualInput onSubmit={onScan} />
        )}

        {/* 최근 스캔 */}
        {recentScans.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <p className="text-xs text-gray-400 font-semibold px-4 py-2 border-b border-gray-100">
              최근 스캔
            </p>
            {recentScans.map((item) => (
              <button
                key={item.id}
                onClick={() => onScan(item.id)}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 border-b border-gray-50 last:border-0 active:bg-gray-50"
              >
                {item.title}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
