import { useEffect, useRef, useCallback, useState } from 'react'
import { createWorker } from 'tesseract.js'

interface Options {
  onScan: (result: string) => void
}

// 등록번호 패턴: 영문 2~4자 + 숫자 4자 이상 (하이픈 선택)
// 예: JRM022999, ABC-12345, SE000123
const REG_PATTERN = /\b[A-Z]{2,4}-?\d{4,}\b/g

function extractRegNumber(text: string): string | null {
  // 공백·줄바꿈 정리 후 대문자로 통일
  const cleaned = text.replace(/\s+/g, ' ').toUpperCase().trim()
  const matches = cleaned.match(REG_PATTERN)
  if (!matches) return null
  // 가장 긴 매치 우선 (노이즈 제거)
  return matches.sort((a, b) => b.length - a.length)[0] ?? null
}

const COOLDOWN_MS = 2500
const CONFIRM_STREAK = 2  // 연속 N회 같은 값이어야 전송

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
  const [ocrText, setOcrText] = useState<string>('')   // 디버그용 인식 텍스트

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

      // 자동 포커스 연속 모드
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
      const worker = await createWorker('eng', undefined, {
        // 숫자·영문자·하이픈만 인식해서 속도·정확도 향상
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-',
      })
      workerRef.current = worker

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return }
        video.addEventListener('loadeddata', () => resolve(), { once: true })
      })
      try { await video.play() } catch { video.muted = true; await video.play() }

      setStatus('스캔 준비 완료')

      // 500ms마다 캔버스에 캡처 후 OCR
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

          // 영상 하단 1/3만 캡처 (등록번호가 보통 아래쪽에 있음)
          const capHeight = Math.floor(video.videoHeight / 3)
          const capY = video.videoHeight - capHeight
          canvas.width = video.videoWidth
          canvas.height = capHeight
          ctx.drawImage(video, 0, capY, video.videoWidth, capHeight, 0, 0, canvas.width, canvas.height)

          // 대비 강화 (흑백 처리)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          for (let i = 0; i < data.length; i += 4) {
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
            const val = avg > 128 ? 255 : 0
            data[i] = data[i + 1] = data[i + 2] = val
          }
          ctx.putImageData(imageData, 0, 0)

          const { data: { text } } = await workerRef.current.recognize(canvas)
          setOcrText(text.trim())

          const regNum = extractRegNumber(text)
          if (regNum) {
            // 연속 스트릭 누적
            if (regNum === streakValueRef.current) {
              streakCountRef.current += 1
            } else {
              streakValueRef.current = regNum
              streakCountRef.current = 1
            }
            // 연속 N회 같은 값이면 확정 전송
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
            // 인식 안 되면 스트릭 리셋
            streakValueRef.current = null
            streakCountRef.current = 0
          }
        } catch {
          // OCR 실패는 정상
        } finally {
          scanningRef.current = false
        }
      }, 500)

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
