import { useState, useCallback, useEffect } from 'react'
import { ScannerView } from '../components/ScannerView'
import { OcrScannerView } from '../components/OcrScannerView'
import { ManualInput } from '../components/ManualInput'
import { submitInventoryScan } from '../lib/inventoryStore'

type Tab = 'barcode' | 'ocr' | 'manual'
type ScanStatus = 'idle' | 'sending' | 'ok' | 'duplicate' | 'error'

interface ScanRecord {
  id: string
  status: 'ok' | 'duplicate' | 'error'
  message?: string
}

interface Props {
  onExit: () => void
}

// AudioContext는 한 번만 생성해서 재사용 (매번 생성하면 suspended 상태)
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  } catch {
    return null
  }
}

async function beep(type: 'ok' | 'duplicate' | 'error') {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    // 브라우저 정책으로 suspended된 경우 resume
    if (ctx.state === 'suspended') await ctx.resume()
    const play = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    if (type === 'ok') play(1200, 0, 0.15)
    else if (type === 'duplicate') play(600, 0, 0.25)
    else { play(400, 0, 0.15); play(400, 0.22, 0.15) }
  } catch {
    // 소리 재생 실패는 무시
  }
}

export function InventoryPage({ onExit }: Props) {
  const [tab, setTab] = useState<Tab>('ocr')
  const [scanned, setScanned] = useState<Set<string>>(new Set())
  const [log, setLog] = useState<ScanRecord[]>([])
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [lastId, setLastId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<{ id: string; type: 'ok' | 'duplicate' | 'error' } | null>(null)
  const [audioReady, setAudioReady] = useState(false)

  useEffect(() => {
    if (!flashId) return
    const timer = setTimeout(() => setFlashId(null), 1500)
    return () => clearTimeout(timer)
  }, [flashId])

  // 첫 사용자 터치로 AudioContext 활성화
  const unlockAudio = useCallback(async () => {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') await ctx.resume()
    setAudioReady(ctx.state === 'running')
  }, [])

  const handleScan = useCallback(async (bookId: string) => {
    const trimmed = bookId.trim()
    if (!trimmed) return

    setLastId(trimmed)

    if (scanned.has(trimmed)) {
      setScanStatus('duplicate')
      setFlashId({ id: trimmed, type: 'duplicate' })
      beep('duplicate')
      setLog(prev => [{ id: trimmed, status: 'duplicate' as const, message: '중복' }, ...prev].slice(0, 50))
      return
    }

    setScanStatus('sending')
    try {
      await submitInventoryScan(trimmed)
      setScanned(prev => new Set(prev).add(trimmed))
      setScanStatus('ok')
      setFlashId({ id: trimmed, type: 'ok' })
      beep('ok')
      setLog(prev => [{ id: trimmed, status: 'ok' as const }, ...prev].slice(0, 50))
    } catch (e) {
      setScanStatus('error')
      const msg = e instanceof Error ? e.message : '오류'
      setFlashId({ id: trimmed, type: 'error' })
      beep('error')
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

  const flashColors = {
    ok: 'bg-green-500',
    duplicate: 'bg-orange-400',
    error: 'bg-red-500',
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" onClick={unlockAudio}>
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

      {/* 소리 활성화 안내 */}
      {!audioReady && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between">
          <span className="text-yellow-800 text-xs">🔇 화면을 한 번 터치하면 소리가 활성화됩니다</span>
          <button
            onClick={unlockAudio}
            className="text-xs bg-yellow-200 text-yellow-900 rounded-full px-3 py-1 active:bg-yellow-300"
          >
            소리 켜기
          </button>
        </div>
      )}

      {flashId && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none`}>
          <div className={`${flashColors[flashId.type]} rounded-2xl px-8 py-5 shadow-2xl animate-pulse`}>
            <p className="text-white font-mono text-2xl font-bold tracking-widest">{flashId.id}</p>
          </div>
        </div>
      )}

      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {banner && (
          <div className={`border rounded-lg px-4 py-2.5 text-sm ${banner.cls}`}>
            {banner.text}
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab('ocr')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'ocr' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            🔤 등록번호
          </button>
          <button
            onClick={() => setTab('barcode')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'barcode' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            📷 바코드
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'manual' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            ⌨️ 직접입력
          </button>
        </div>

        {tab === 'ocr' && <OcrScannerView onScan={handleScan} />}
        {tab === 'barcode' && <ScannerView onScan={handleScan} />}
        {tab === 'manual' && <ManualInput onSubmit={handleScan} />}

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
