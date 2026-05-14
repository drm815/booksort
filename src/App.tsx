import { useState } from 'react'
import { useBookStore } from './hooks/useBookStore'
import { findShelfNeighbors } from './lib/shelfFinder'
import { ScanPage } from './pages/ScanPage'
import { ResultPage } from './pages/ResultPage'
import type { ShelfResult } from './types'

interface RecentItem {
  id: string
  title: string
}

export default function App() {
  const { books, loading, error, refresh } = useBookStore()
  const [result, setResult] = useState<ShelfResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [recentScans, setRecentScans] = useState<RecentItem[]>([])

  const handleScan = (bookId: string) => {
    setScanError(null)
    // 바코드에서 읽힌 원시값 그대로 검색 (앞뒤 공백 제거)
    const trimmed = bookId.trim()
    const found = findShelfNeighbors(books, trimmed)
    if (!found) {
      setScanError(`"${trimmed}" — 도서목록에 없습니다. (스캔값 확인용)`)
      return
    }
    setRecentScans((prev) => {
      const filtered = prev.filter((r) => r.id !== trimmed)
      return [{ id: trimmed, title: found.current.title }, ...filtered].slice(0, 5)
    })
    setResult(found)
  }

  // 로딩 중이어도 UI는 보여주고 배너만 표시

  if (result) {
    return <ResultPage result={result} onBack={() => setResult(null)} />
  }

  return (
    <>
      {loading && books.length === 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-xs text-center py-2 px-4">
          도서목록 불러오는 중... 잠시 후 사용 가능합니다
        </div>
      )}
      <ScanPage
        onScan={handleScan}
        recentScans={recentScans}
        loading={loading}
        error={scanError ?? error}
        onRefresh={refresh}
      />
    </>
  )
}
