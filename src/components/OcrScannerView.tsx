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

        {/* 어두운 오버레이 — 박스 바깥 영역 */}
        {/* 위 */}
        <div className="absolute top-0 left-0 right-0" style={{ height: '38%', background: 'rgba(0,0,0,0.5)' }} />
        {/* 아래 */}
        <div className="absolute bottom-0 left-0 right-0" style={{ top: '62%', background: 'rgba(0,0,0,0.5)' }} />
        {/* 왼쪽 */}
        <div className="absolute left-0" style={{ top: '38%', bottom: '38%', width: '10%', background: 'rgba(0,0,0,0.5)' }} />
        {/* 오른쪽 */}
        <div className="absolute right-0" style={{ top: '38%', bottom: '38%', width: '10%', background: 'rgba(0,0,0,0.5)' }} />

        {/* 가이드 박스 테두리 */}
        <div
          className="absolute"
          style={{ top: '38%', left: '10%', right: '10%', bottom: '38%' }}
        >
          {/* 모서리 */}
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-green-400" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-green-400" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-green-400" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-green-400" />
          {/* 중앙 스캔 라인 */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-green-400 opacity-60" />
        </div>

        {/* 상태 */}
        <div className="absolute top-2 left-0 right-0 flex justify-center">
          <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">{status}</span>
        </div>

        {/* 인식된 텍스트 — 박스 하단에 표시 */}
        <div className="absolute left-0 right-0 flex justify-center" style={{ top: '63%' }}>
          {ocrText ? (
            <span className="bg-black/70 text-green-300 text-xs font-mono px-3 py-1 rounded-full max-w-[80%] truncate">
              {ocrText}
            </span>
          ) : (
            <span className="text-white/50 text-xs">등록번호를 박스 안에 맞춰주세요</span>
          )}
        </div>
      </div>

      {/* 숨겨진 캔버스 (OCR 처리용) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
