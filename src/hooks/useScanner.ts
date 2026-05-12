import { useEffect, useRef, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

interface Options {
  onScan: (result: string) => void
  onError?: (error: Error) => void
}

export function useScanner({ onScan, onError }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)

  const start = useCallback(async () => {
    if (!videoRef.current) return
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader
    try {
      await reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          onScan(result.getText())
        } else if (err && !(err instanceof NotFoundException)) {
          onError?.(err as Error)
        }
      })
    } catch (e) {
      onError?.(e as Error)
    }
  }, [onScan, onError])

  const stop = useCallback(() => {
    readerRef.current?.reset()
    readerRef.current = null
  }, [])

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return { videoRef }
}
