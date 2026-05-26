import { useState, useRef } from 'react'
import { ScannerView } from '../components/ScannerView'

const PREFIX = 'JRM'

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
  onInventory: () => void
}

export function ScanPage({ onScan, recentScans, loading, error, onRefresh, onInventory }: Props) {
  const [tab, setTab] = useState<Tab>('manual')
  const [numSuffix, setNumSuffix] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleScan = (bookId: string) => {
    onScan(bookId)
  }

  const handleNumSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!numSuffix) return
    const bookId = PREFIX + numSuffix
    setNumSuffix('')
    setTimeout(() => inputRef.current?.focus(), 50)
    handleScan(bookId)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
        <h1 className="font-bold text-lg">📚 책정리 도우미</h1>
        <div className="flex gap-2">
          <button
            onClick={onInventory}
            className="text-white text-sm bg-blue-500 rounded-full px-3 py-1 active:bg-blue-700"
          >
            📋 장서점검
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-white text-sm bg-blue-500 rounded-full px-3 py-1 active:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '로딩중...' : '🔄'}
          </button>
        </div>
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
        {tab === 'camera' && <ScannerView onScan={handleScan} />}
        {tab === 'manual' && (
          <form onSubmit={handleNumSubmit} className="flex flex-col gap-3">
            <div className="flex items-center border-2 border-blue-500 rounded-xl bg-white overflow-hidden focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-200">
              <span className="pl-4 py-4 text-2xl font-mono font-bold text-blue-600 select-none pointer-events-none">
                {PREFIX}
              </span>
              <input
                ref={inputRef}
                type="tel"
                value={numSuffix}
                onChange={(e) => setNumSuffix(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="022999"
                className="flex-1 pr-4 py-4 text-2xl font-mono tracking-widest focus:outline-none bg-transparent"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!numSuffix}
              className="w-full py-4 rounded-xl text-lg font-bold bg-blue-600 text-white active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              검색 → {numSuffix ? `${PREFIX}${numSuffix}` : ''}
            </button>
          </form>
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
