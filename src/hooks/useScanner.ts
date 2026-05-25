import { useEffect, useRef, useCallback, useState } from 'react'

interface Options {
  onScan: (result: string) => void
}

// BarcodeDetector API 타입 선언 (브라우저 네이티브)
declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  detect(image: HTMLVideoElement | ImageBitmap): Promise<Array<{ rawValue: string }>>
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) { resolve(); return }
    const onReady = () => { cleanup(); resolve() }
    const onError = (e: Event) => { cleanup(); reject(e) }
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('error', onError)
    // 5초 타임아웃
    setTimeout(() => { cleanup(); resolve() }, 5000)
  })
}

const SCAN_INTERVAL_MS = 300      // 인식 시도 간격 (ms) — 너무 빠르면 오인식↑
const CONFIRM_WINDOW_MS = 900     // 이 시간 안에 같은 값이 과반수면 확정
const COOLDOWN_MS = 2000          // 같은 바코드 재전송 방지 시간

export function useScanner({ onScan }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanningRef = useRef(false)                  // 진행 중인 detect() 겹침 방지
  const lastValueRef = useRef<string | null>(null)
  const lastTimeRef = useRef<number>(0)
  const windowRef = useRef<string[]>([])             // 최근 N회 인식 결과 윈도우
  const [error, setScannerError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('초기화 중...')

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    timerRef.current = null
    streamRef.current = null
    scanningRef.current = false
    windowRef.current = []
  }, [])

  const start = useCallback(async () => {
    setScannerError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError('이 브라우저는 카메라를 지원하지 않습니다. Chrome을 사용해주세요.')
        return
      }

      setStatus('카메라 연결 중...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream

      if (!videoRef.current) return
      const video = videoRef.current
      video.srcObject = stream
      video.muted = true
      video.playsInline = true

      setStatus('영상 로드 중...')
      await waitForVideoReady(video)

      setStatus('재생 시작...')
      try { await video.play() } catch { video.muted = true; await video.play() }

      setStatus('스캔 준비 완료')

      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e', 'codabar'],
        })

        // SCAN_INTERVAL_MS마다 1회 인식 — 이전 detect()가 끝나야 다음 실행
        timerRef.current = setInterval(async () => {
          if (scanningRef.current) return
          if (!videoRef.current || videoRef.current.readyState < 2) return

          scanningRef.current = true
          try {
            const results = await detector.detect(videoRef.current)
            const value = results.length > 0 ? results[0].rawValue : null

            // 슬라이딩 윈도우에 결과 추가 (윈도우 크기 = CONFIRM_WINDOW_MS / SCAN_INTERVAL_MS)
            const windowSize = Math.ceil(CONFIRM_WINDOW_MS / SCAN_INTERVAL_MS)
            windowRef.current = [...windowRef.current.slice(-(windowSize - 1)), value ?? '']

            // 윈도우가 꽉 찼을 때 과반수 값 확인
            if (windowRef.current.length >= windowSize) {
              const counts: Record<string, number> = {}
              for (const v of windowRef.current) {
                if (v) counts[v] = (counts[v] ?? 0) + 1
              }
              const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
              if (best && best[1] >= Math.ceil(windowSize / 2)) {
                const confirmed = best[0]
                const now = Date.now()
                if (confirmed !== lastValueRef.current || now - lastTimeRef.current > COOLDOWN_MS) {
                  lastValueRef.current = confirmed
                  lastTimeRef.current = now
                  windowRef.current = [] // 확정 후 윈도우 초기화
                  onScan(confirmed)
                }
              }
            }
          } catch {
            // 인식 실패는 정상
          } finally {
            scanningRef.current = false
          }
        }, SCAN_INTERVAL_MS)

      } else {
        // fallback: @zxing/library (BarcodeDetector 미지원 브라우저)
        const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library')
        const reader = new BrowserMultiFormatReader()
        await reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
          if (result) {
            const value = result.getText()
            const now = Date.now()
            if (value !== lastValueRef.current || now - lastTimeRef.current > COOLDOWN_MS) {
              lastValueRef.current = value
              lastTimeRef.current = now
              onScan(value)
            }
          } else if (err && !(err instanceof NotFoundException)) {
            // 실제 오류만 로깅
          }
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Permission') || msg.includes('permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
        setScannerError('카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라를 허용해주세요.')
      } else if (msg.includes('NotFound') || msg.includes('Devices')) {
        setScannerError('카메라를 찾을 수 없습니다.')
      } else {
        setScannerError(`카메라 오류: ${msg}`)
      }
    }
  }, [onScan])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start()
    return () => stop()
  }, [start, stop])

  return { videoRef, error, status }
}
