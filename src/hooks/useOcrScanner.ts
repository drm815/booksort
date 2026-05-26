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

// 가이드 박스가 영상에서 차지하는 비율 (OcrScannerView와 동기화)
// 가로 80%, 세로 중앙 기준 위아래 12% (전체 24%)
const BOX_X_RATIO = 0.1        // 좌측 여백
const BOX_W_RATIO = 0.8        // 박스 너비
const BOX_Y_RATIO = 0.38       // 박스 상단 (중앙 0.5 - 높이 0.12)
const BOX_H_RATIO = 0.24       // 박스 높이

export function useOcrScanner({ onScan }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null)
  const scanningRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastValueRef = useRef<string | null>(null)
  const lastTimeRef = useRef<number>(0)
  const streakValueRef = useRef<string | null>(null)
  const streakCountRef = useRef<number>(0)

  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('초기화 중...')
  const [ocrText, setOcrText] = useState<string>('')

  const stop = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    timerRef.current = null
    streamRef.current = null
    scanningRef.current = false
    streakValueRef.current = null
    streakCountRef.current = 0
    if (workerRef.current) {
      await workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
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
        // PSM.SINGLE_LINE: 한 줄 텍스트로 간주 → 등록번호처럼 짧은 텍스트에 최적
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      })
      workerRef.current = worker

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return }
        video.addEventListener('loadeddata', () => resolve(), { once: true })
      })
      try { await video.play() } catch { video.muted = true; await video.play() }

      setStatus('등록번호를 박스 안에 맞춰주세요')

      timerRef.current = setInterval(async () => {
        if (scanningRef.current) return
        if (!videoRef.current || !canvasRef.current || !workerRef.current) return
        if (videoRef.current.readyState < 2) return

        scanningRef.current = true
        try {
          const video = videoRef.current
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          const vw = video.videoWidth
          const vh = video.videoHeight

          // 가이드 박스 영역만 캡처
          const sx = Math.floor(vw * BOX_X_RATIO)
          const sy = Math.floor(vh * BOX_Y_RATIO)
          const sw = Math.floor(vw * BOX_W_RATIO)
          const sh = Math.floor(vh * BOX_H_RATIO)

          // 2배 업스케일해서 OCR 정확도 향상
          canvas.width = sw * 2
          canvas.height = sh * 2
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

          // 그레이스케일 + 대비 강화 (어두운 배경 지원을 위해 adaptive threshold)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const d = imageData.data
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
            // 대비 강화: 중간값 기준으로 흑백 분리
            const val = gray > 140 ? 255 : 0
            d[i] = d[i + 1] = d[i + 2] = val
          }
          ctx.putImageData(imageData, 0, 0)

          const { data: { text } } = await workerRef.current.recognize(canvas)
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
          scanningRef.current = false
        }
      }, 600)

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
