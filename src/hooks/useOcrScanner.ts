import { useEffect, useRef, useCallback, useState } from 'react'

interface Options {
  onScan: (result: string) => void
}

const REG_PATTERN = /\b[A-Z]{2,4}-?\d{4,}\b/g

function extractRegNumber(text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ').toUpperCase().trim()
  const matches = cleaned.match(REG_PATTERN)
  if (!matches) return null
  return matches.sort((a, b) => b.length - a.length)[0] ?? null
}

// 가이드 박스 비율 (OcrScannerView와 동기화)
const BOX_X_RATIO = 0.1
const BOX_W_RATIO = 0.8
const BOX_Y_RATIO = 0.38
const BOX_H_RATIO = 0.24

// GAS OCR 엔드포인트 (장서점검과 별도 URL — CORS 허용 배포)
const OCR_URL = import.meta.env.VITE_OCR_SCRIPT_URL

async function callVisionOcr(canvas: HTMLCanvasElement): Promise<string> {
  if (!OCR_URL) throw new Error('VITE_OCR_SCRIPT_URL 환경변수가 설정되지 않았습니다.')
  const base64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
  const res = await fetch(OCR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ocr', image: base64 }),
  })
  if (!res.ok) throw new Error(`서버 오류: ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.message || 'OCR 실패')
  return String(data.text ?? '')
}

export type OcrState = 'idle' | 'scanning' | 'done' | 'error'

export function useOcrScanner({ onScan }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [camReady, setCamReady] = useState(false)
  const [ocrState, setOcrState] = useState<OcrState>('idle')
  const [ocrText, setOcrText] = useState<string>('')
  const [result, setResult] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('이 브라우저는 카메라를 지원하지 않습니다.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      try {
        const track = stream.getVideoTracks()[0]
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
      } catch { /* 미지원 무시 */ }

      if (!videoRef.current) return
      const video = videoRef.current
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return }
        video.addEventListener('loadeddata', () => resolve(), { once: true })
      })
      try { await video.play() } catch { video.muted = true; await video.play() }
      setCamReady(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
        setError('카메라 접근 권한이 필요합니다.')
      } else {
        setError(`오류: ${msg}`)
      }
    }
  }, [])

  // 셔터: 버튼 누를 때 캡처 → GAS → Vision API → 결과 반환
  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    if (ocrState === 'scanning') return

    setOcrState('scanning')
    setOcrText('')
    setResult(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const vw = video.videoWidth
      const vh = video.videoHeight
      const sx = Math.floor(vw * BOX_X_RATIO)
      const sy = Math.floor(vh * BOX_Y_RATIO)
      const sw = Math.floor(vw * BOX_W_RATIO)
      const sh = Math.floor(vh * BOX_H_RATIO)

      canvas.width = sw
      canvas.height = sh
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)

      const text = await callVisionOcr(canvas)
      setOcrText(text)

      const regNum = extractRegNumber(text)
      if (regNum) {
        setResult(regNum)
        setOcrState('done')
        onScan(regNum)
      } else {
        setResult(null)
        setOcrState('error')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'OCR 실패'
      setOcrText(msg)
      setOcrState('error')
    }
  }, [ocrState, onScan])

  const reset = useCallback(() => {
    setOcrState('idle')
    setOcrText('')
    setResult(null)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start()
    return () => { stop() }
  }, [start, stop])

  return { videoRef, canvasRef, error, camReady, ocrState, ocrText, result, capture, reset }
}
