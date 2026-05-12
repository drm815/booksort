import { useEffect, useRef, useCallback, useState } from 'react'

interface Options {
  onScan: (result: string) => void
}

// BarcodeDetector API 타입 선언 (브라우저 네이티브)
declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  detect(image: HTMLVideoElement | ImageBitmap): Promise<Array<{ rawValue: string }>>
}

export function useScanner({ onScan }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastValueRef = useRef<string | null>(null)
  const lastTimeRef = useRef<number>(0)
  const [error, setScannerError] = useState<string | null>(null)

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    rafRef.current = null
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setScannerError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      // BarcodeDetector 우선 사용 (Android Chrome, iOS Safari 17+)
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
              // 같은 값은 2초 내 재인식 무시
              if (value !== lastValueRef.current || now - lastTimeRef.current > 2000) {
                lastValueRef.current = value
                lastTimeRef.current = now
                onScan(value)
              }
            }
          } catch {
            // 인식 실패는 정상 (바코드 없는 프레임)
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
            // 실제 오류만 무시 (인식 실패는 정상)
          }
        })
      }
    } catch (e) {
      setScannerError('카메라 접근 권한이 필요합니다.')
    }
  }, [onScan])

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return { videoRef, error }
}
