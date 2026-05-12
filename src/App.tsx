import { useState } from 'react'
import { useBookStore } from './hooks/useBookStore'
import { findShelfNeighbors } from './lib/shelfFinder'
import { ScanPage } from './pages/ScanPage'
import { ResultPage } from './pages/ResultPage'
import { LoadingSpinner } from './components/LoadingSpinner'
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
    const found = findShelfNeighbors(books, bookId)
    if (!found) {
      setScanError(`등록번호 "${bookId}"를 찾을 수 없습니다.`)
      return
    }
    setRecentScans((prev) => {
      const filtered = prev.filter((r) => r.id !== bookId)
      return [{ id: bookId, title: found.current.title }, ...filtered].slice(0, 5)
    })
    setResult(found)
  }

  if (loading && books.length === 0) return <LoadingSpinner />

  if (result) {
    return <ResultPage result={result} onBack={() => setResult(null)} />
  }

  return (
    <ScanPage
      onScan={handleScan}
      recentScans={recentScans}
      loading={loading}
      error={scanError ?? error}
      onRefresh={refresh}
    />
  )
}
