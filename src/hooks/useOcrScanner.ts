import { useEffect, useRef, useCallback, useState } from 'react'
import { createWorker, PSM } from 'tesseract.js'

interface Options {
  onScan: (result: string) => void
}

// 등록번호 패턴: 영문 2~4자 + 숫자 4자 이상 (하이픈 선택)
// 예: JRM022999, ABC-12345, SE000123
const REG_PATTERN = /\b[A-Z]{2,4}-?\d{4,}\b/g

function extractRegNumber(text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ').toUpperCase().trim()
  const matches = cleaned.match(REG_PATTERN)
  if (!matches) return null
  return matches.sort((a, b) => b.length - a.length)[0] ?? null
}

const COOLDOWN_MS = 2500
const CONFIRM_STREAK = 2

// 가이드 박스 비율 (OcrScannerView와 동기화)
const BOX_X_RATIO = 0.1
const BOX_W_RATIO = 0.8
const BOX_Y_RATIO = 0.38
const BOX_H_RATIO = 0.24

// 이미지 전처리: 그레이스케일 → 정규화 → 이진화
function preprocessCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  const n = d.length / 4

  // 1단계: 그레이스케일 변환
  const gray = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2])
  }

  // 2단계: 최소·최대값 기반 정규화 (조명 불균일 보정)
  let min = 255, max = 0
  for (let i = 0; i < n; i++) { if (gray[i] < min) min = gray[i]; if (gray[i] > max) max = gray[i] }
  const range = max - min || 1

  // 3단계: 이진화 (정규화된 값 기준 50%)
  for (let i = 0; i < n; i++) {
    const norm = ((gray[i] - min) / range) * 255
    const val = norm > 128 ? 255 : 0
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = val
    d[i * 4 + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}

export function useOcrScanner({ onScan }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null)
  const runningRef = useRef(false)   // 루프 실행 중 여부
  const activeRef = useRef(false)    // 마운트 여부 (언마운트 시 루프 중단)
  const lastValueRef = useRef<string | null>(null)
  const lastTimeRef = useRef<number>(0)
  const streakValueRef = useRef<string | null>(null)
  const streakCountRef = useRef<number>(0)

  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('초기화 중...')
  const [ocrText, setOcrText] = useState<string>('')

  const stop = useCallback(async () => {
    activeRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    streakValueRef.current = null
    streakCountRef.current = 0
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

      setStatus('카메라 연결 중...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream

      try {
        const track = stream.getVideoTracks()[0]
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
      } catch { /* 미지원 기기 무시 */ }

      if (!videoRef.current) return
      const video = videoRef.current
      video.srcObject = stream
      video.muted = true
      video.playsInline = true

      setStatus('OCR 엔진 로드 중...')
      const worker = await createWorker('eng')
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      })
      workerRef.current = worker

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return }
        video.addEventListener('loadeddata', () => resolve(), { once: true })
      })
      try { await video.play() } catch { video.muted = true; await video.play() }

      setStatus('등록번호를 박스 안에 맞춰주세요')

      // setInterval 대신 재귀 루프 — 이전 OCR이 끝난 직후 바로 다음 시도
      const loop = async () => {
        if (!activeRef.current) return
        if (runningRef.current) { setTimeout(loop, 100); return }
        if (!videoRef.current || !canvasRef.current || !workerRef.current) { setTimeout(loop, 200); return }
        if (videoRef.current.readyState < 2) { setTimeout(loop, 200); return }

        runningRef.current = true
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

          // 3배 업스케일 (이전 2배에서 향상)
          canvas.width = sw * 3
          canvas.height = sh * 3
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

          // 전처리: 정규화 + 이진화
          preprocessCanvas(ctx, canvas.width, canvas.height)

          const { data: { text } } = await workerRef.current.recognize(canvas)
          if (!activeRef.current) return

          const trimmed = text.trim()
          setOcrText(trimmed)

          const regNum = extractRegNumber(trimmed)
          if (regNum) {
            if (regNum === streakValueRef.current) {
              streakCountRef.current += 1
            } else {
              streakValueRef.current = regNum
              streakCountRef.current = 1
            }
            if (streakCountRef.current >= CONFIRM_STREAK) {
              const now = Date.now()
              if (regNum !== lastValueRef.current || now - lastTimeRef.current > COOLDOWN_MS) {
                lastValueRef.current = regNum
                lastTimeRef.current = now
                streakValueRef.current = null
                streakCountRef.current = 0
                onScan(regNum)
              }
            }
          } else {
            streakValueRef.current = null
            streakCountRef.current = 0
          }
        } catch {
          // OCR 실패는 정상
        } finally {
          runningRef.current = false
          // 다음 루프 — 짧은 딜레이 후 즉시 재시도
          if (activeRef.current) setTimeout(loop, 300)
        }
      }

      loop()

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Permission') || msg.includes('NotAllowed') || msg.includes('denied')) {
        setError('카메라 접근 권한이 필요합니다.')
      } else {
        setError(`오류: ${msg}`)
      }
    }
  }, [onScan])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start()
    return () => { stop() }
  }, [start, stop])

  return { videoRef, canvasRef, error, status, ocrText }
}
