import { useEffect, useRef, useCallback, useState } from 'react'
import { createWorker, PSM } from 'tesseract.js'

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

function preprocessCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  const n = d.length / 4
  const gray = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2])
  }
  let min = 255, max = 0
  for (let i = 0; i < n; i++) { if (gray[i] < min) min = gray[i]; if (gray[i] > max) max = gray[i] }
  const range = max - min || 1
  for (let i = 0; i < n; i++) {
    const norm = ((gray[i] - min) / range) * 255
    const val = norm > 128 ? 255 : 0
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = val
    d[i * 4 + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}

export type OcrState = 'idle' | 'scanning' | 'done' | 'error'

export function useOcrScanner({ onScan }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null)
  const activeRef = useRef(false)

  const [error, setError] = useState<string | null>(null)
  const [camReady, setCamReady] = useState(false)
  const [ocrState, setOcrState] = useState<OcrState>('idle')
  const [ocrText, setOcrText] = useState<string>('')   // 인식된 원본 텍스트
  const [result, setResult] = useState<string | null>(null)  // 패턴 매칭된 번호

  const stop = useCallback(async () => {
    activeRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (workerRef.current) {
      await workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    activeRef.current = true
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

      // Tesseract 워커 백그라운드 로드
      const worker = await createWorker('eng')
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      })
      workerRef.current = worker
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

  // 셔터: 버튼 누를 때 1회 OCR
  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current) return
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

      canvas.width = sw * 3
      canvas.height = sh * 3
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      preprocessCanvas(ctx, canvas.width, canvas.height)

      const { data: { text } } = await workerRef.current.recognize(canvas)
      const trimmed = text.trim()
      setOcrText(trimmed)

      const regNum = extractRegNumber(trimmed)
      if (regNum) {
        setResult(regNum)
        setOcrState('done')
        onScan(regNum)
      } else {
        setResult(null)
        setOcrState('error')
      }
    } catch {
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
