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

const SCAN_INTERVAL_MS = 150      // 인식 시도 간격 — 빠를수록 반응성↑
const CONFIRM_STREAK = 2          // 연속 N회 같은 값이면 확정
const COOLDOWN_MS = 2500          // 같은 바코드 재전송 방지 시간

export function useScanner({ onScan }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanningRef = useRef(false)           // 진행 중인 detect() 겹침 방지
  const lastValueRef = useRef<string | null>(null)
  const lastTimeRef = useRef<number>(0)
  const streakValueRef = useRef<string | null>(null)  // 현재 연속 중인 값
  const streakCountRef = useRef<number>(0)             // 연속 횟수
  const [error, setScannerError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('초기화 중...')

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    timerRef.current = null
    streamRef.current = null
    scanningRef.current = false
    streakValueRef.current = null
    streakCountRef.current = 0
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
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      // 가능하면 자동 포커스 연속 모드 적용
      try {
        const track = stream.getVideoTracks()[0]
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
      } catch { /* 미지원 기기는 무시 */ }
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

            if (value) {
              // 같은 값이면 연속 카운트 증가, 다른 값이면 리셋
              if (value === streakValueRef.current) {
                streakCountRef.current += 1
              } else {
                streakValueRef.current = value
                streakCountRef.current = 1
              }
              // 연속 N회 달성 시 확정
              if (streakCountRef.current >= CONFIRM_STREAK) {
                const now = Date.now()
                if (value !== lastValueRef.current || now - lastTimeRef.current > COOLDOWN_MS) {
                  lastValueRef.current = value
                  lastTimeRef.current = now
                  streakValueRef.current = null
                  streakCountRef.current = 0
                  onScan(value)
                }
              }
            } else {
              // 인식 안 되면 연속 카운트 리셋
              streakValueRef.current = null
              streakCountRef.current = 0
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
