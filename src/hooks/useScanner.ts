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

export function useScanner({ onScan }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastValueRef = useRef<string | null>(null)
  const lastTimeRef = useRef<number>(0)
  const [error, setScannerError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('초기화 중...')

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    rafRef.current = null
    streamRef.current = null
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
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      if (!videoRef.current) return
      const video = videoRef.current

      // srcObject 설정 후 메타데이터 로드 대기
      video.srcObject = stream
      video.muted = true
      video.playsInline = true

      setStatus('영상 로드 중...')
      await waitForVideoReady(video)

      setStatus('재생 시작...')
      try {
        await video.play()
      } catch {
        video.muted = true
        await video.play()
      }

      setStatus('스캔 준비 완료')

      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e', 'codabar'],
        })

        const scan = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            rafRef.current = requestAnimationFrame(scan)
            return
          }
          try {
            const results = await detector.detect(videoRef.current)
            if (results.length > 0) {
              const value = results[0].rawValue
              const now = Date.now()
              if (value !== lastValueRef.current || now - lastTimeRef.current > 2000) {
                lastValueRef.current = value
                lastTimeRef.current = now
                onScan(value)
              }
            }
          } catch {
            // 인식 실패는 정상
          }
          rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)
      } else {
        // fallback: @zxing/library
        const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library')
        const reader = new BrowserMultiFormatReader()
        await reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
          if (result) {
            const value = result.getText()
            const now = Date.now()
            if (value !== lastValueRef.current || now - lastTimeRef.current > 2000) {
              lastValueRef.current = value
              lastTimeRef.current = now
              onScan(value)
            }
          } else if (err && !(err instanceof NotFoundException)) {
            // 실제 오류만 무시
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
