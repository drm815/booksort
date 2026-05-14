import { useState } from 'react'
import { useBookStore } from './hooks/useBookStore'
import { findShelfNeighbors } from './lib/shelfFinder'
import { ScanPage } from './pages/ScanPage'
import { ResultPage } from './pages/ResultPage'
import type { ShelfResult } from './types'

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent
  return (
    /NAVER/.test(ua) ||        // 네이버 앱
    /Instagram/.test(ua) ||    // 인스타그램
    /KAKAOTALK/.test(ua) ||    // 카카오톡
    /FB_IAB|FBAN|FBAV/.test(ua) || // 페이스북
    /Line\//.test(ua) ||       // 라인
    (/iPhone|iPad/.test(ua) && /Safari/.test(ua) === false && /CriOS|FxiOS/.test(ua) === false)
  )
}

function InAppBrowserWarning() {
  const ua = navigator.userAgent
  const appName = /NAVER/.test(ua) ? '네이버' : /KAKAOTALK/.test(ua) ? '카카오톡' : /Instagram/.test(ua) ? '인스타그램' : '현재 앱'

  const handleOpen = () => {
    window.open(window.location.href, '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-lg font-bold text-gray-800">
        {appName} 브라우저에서는<br />카메라를 사용할 수 없습니다
      </h1>
      <p className="text-sm text-gray-500 leading-relaxed">
        카메라 스캔 기능을 사용하려면<br />
        <strong>Chrome 또는 Safari</strong>로 열어주세요
      </p>
      <button
        onClick={handleOpen}
        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm active:bg-blue-700"
      >
        외부 브라우저로 열기
      </button>
      <p className="text-xs text-gray-400">
        또는 주소를 복사해서 Chrome에 붙여넣기<br />
        <span className="font-mono text-gray-600">{window.location.href}</span>
      </p>
      <button
        onClick={() => navigator.clipboard?.writeText(window.location.href)}
        className="text-blue-500 text-xs underline"
      >
        주소 복사
      </button>
    </div>
  )
}

interface RecentItem {
  id: string
  title: string
}

export default function App() {
  if (isInAppBrowser()) return <InAppBrowserWarning />
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
