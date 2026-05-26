import { useOcrScanner } from '../hooks/useOcrScanner'

interface Props {
  onScan: (bookId: string) => void
}

export function OcrScannerView({ onScan }: Props) {
  const { videoRef, canvasRef, error, status, ocrText } = useOcrScanner({ onScan })

  if (error) {
    return (
      <div className="w-full aspect-[4/3] bg-gray-900 rounded-xl flex items-center justify-center">
        <p className="text-white text-sm text-center px-6">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

        {/* 등록번호 인식 영역 표시 — 하단 1/3 */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 border-t-2 border-green-400 border-dashed">
          <span className="absolute top-1 left-2 text-green-300 text-xs bg-black/50 px-2 py-0.5 rounded">
            등록번호 영역
          </span>
        </div>

        {/* 상태 표시 */}
        <div className="absolute top-2 left-0 right-0 flex justify-center">
          <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">{status}</span>
        </div>
      </div>

      {/* OCR 인식 결과 디버그 표시 */}
      {ocrText ? (
        <div className="bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-500 font-mono break-all">
          인식: {ocrText}
        </div>
      ) : null}

      {/* 숨겨진 캔버스 (OCR 처리용) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
