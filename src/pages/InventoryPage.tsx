import { useState, useCallback } from 'react'
import { ScannerView } from '../components/ScannerView'
import { ManualInput } from '../components/ManualInput'
import { submitInventoryScan } from '../lib/inventoryStore'

type Tab = 'camera' | 'manual'
type ScanStatus = 'idle' | 'sending' | 'ok' | 'duplicate' | 'error'

interface ScanRecord {
  id: string
  status: 'ok' | 'duplicate' | 'error'
  message?: string
}

interface Props {
  onExit: () => void
}

export function InventoryPage({ onExit }: Props) {
  const [tab, setTab] = useState<Tab>('camera')
  const [scanned, setScanned] = useState<Set<string>>(new Set())
  const [log, setLog] = useState<ScanRecord[]>([])
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [lastId, setLastId] = useState<string | null>(null)

  const handleScan = useCallback(async (bookId: string) => {
    const trimmed = bookId.trim()
    if (!trimmed) return

    setLastId(trimmed)

    if (scanned.has(trimmed)) {
      setScanStatus('duplicate')
      setLog(prev => [{ id: trimmed, status: 'duplicate' as const, message: '중복' }, ...prev].slice(0, 50))
      return
    }

    setScanStatus('sending')
    try {
      await submitInventoryScan(trimmed)
      setScanned(prev => new Set(prev).add(trimmed))
      setScanStatus('ok')
      setLog(prev => [{ id: trimmed, status: 'ok' as const }, ...prev].slice(0, 50))
    } catch (e) {
      setScanStatus('error')
      const msg = e instanceof Error ? e.message : '오류'
      setLog(prev => [{ id: trimmed, status: 'error' as const, message: msg }, ...prev].slice(0, 50))
    }
  }, [scanned])

  const statusBanner = () => {
    if (scanStatus === 'sending') return { text: '전송 중...', cls: 'bg-yellow-50 border-yellow-200 text-yellow-800' }
    if (scanStatus === 'ok') return { text: `✅ ${lastId} 저장됨`, cls: 'bg-green-50 border-green-200 text-green-800' }
    if (scanStatus === 'duplicate') return { text: `⚠️ ${lastId} — 이미 스캔됨`, cls: 'bg-orange-50 border-orange-200 text-orange-800' }
    if (scanStatus === 'error') return { text: `❌ 전송 실패`, cls: 'bg-red-50 border-red-200 text-red-800' }
    return null
  }

  const banner = statusBanner()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-green-600 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-lg">📋 장서점검</h1>
          <p className="text-green-200 text-xs">스캔 완료: {scanned.size}권</p>
        </div>
        <button
          onClick={onExit}
          className="text-white text-sm bg-green-500 rounded-full px-3 py-1 active:bg-green-700"
        >
          ← 돌아가기
        </button>
      </header>

      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {banner && (
          <div className={`border rounded-lg px-4 py-2.5 text-sm ${banner.cls}`}>
            {banner.text}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('camera')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'camera' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            📷 카메라 스캔
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'manual' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            ⌨️ 번호 입력
          </button>
        </div>

        {tab === 'camera' ? (
          <ScannerView onScan={handleScan} />
        ) : (
          <ManualInput onSubmit={handleScan} />
        )}

        {/* 스캔 로그 */}
        {log.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <p className="text-xs text-gray-400 font-semibold px-4 py-2 border-b border-gray-100">
              스캔 기록
            </p>
            {log.map((item, i) => (
              <div
                key={i}
                className="px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 flex justify-between items-center"
              >
                <span className="font-mono text-gray-800">{item.id}</span>
                <span className={`text-xs ${
                  item.status === 'ok' ? 'text-green-600' :
                  item.status === 'duplicate' ? 'text-orange-500' : 'text-red-500'
                }`}>
                  {item.status === 'ok' ? '저장' : item.status === 'duplicate' ? '중복' : '오류'}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
