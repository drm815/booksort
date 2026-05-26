import { useOcrScanner } from '../hooks/useOcrScanner'

interface Props {
  onScan: (bookId: string) => void
}

export function OcrScannerView({ onScan }: Props) {
  const { videoRef, canvasRef, error, camReady, ocrState, ocrText, result, capture, reset } = useOcrScanner({ onScan })

  if (error) {
    return (
      <div className="w-full aspect-[4/3] bg-gray-900 rounded-xl flex items-center justify-center">
        <p className="text-white text-sm text-center px-6">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 카메라 뷰 */}
      <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

        {/* 가이드 박스 바깥 오버레이 */}
        <div className="absolute top-0 left-0 right-0" style={{ height: '38%', background: 'rgba(0,0,0,0.5)' }} />
        <div className="absolute bottom-0 left-0 right-0" style={{ top: '62%', background: 'rgba(0,0,0,0.5)' }} />
        <div className="absolute left-0" style={{ top: '38%', bottom: '38%', width: '10%', background: 'rgba(0,0,0,0.5)' }} />
        <div className="absolute right-0" style={{ top: '38%', bottom: '38%', width: '10%', background: 'rgba(0,0,0,0.5)' }} />

        {/* 가이드 박스 */}
        <div className="absolute" style={{ top: '38%', left: '10%', right: '10%', bottom: '38%' }}>
          <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${ocrState === 'done' ? 'border-green-400' : 'border-white'}`} />
          <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${ocrState === 'done' ? 'border-green-400' : 'border-white'}`} />
          <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${ocrState === 'done' ? 'border-green-400' : 'border-white'}`} />
          <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${ocrState === 'done' ? 'border-green-400' : 'border-white'}`} />
        </div>

        {/* 상단 안내 */}
        <div className="absolute top-2 left-0 right-0 flex justify-center">
          <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
            {!camReady ? '카메라 준비 중...' : '등록번호를 박스에 맞추고 📸 버튼을 누르세요'}
          </span>
        </div>

        {/* OCR 중 오버레이 */}
        {ocrState === 'scanning' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-black/80 text-white text-sm px-5 py-3 rounded-xl">인식 중...</div>
          </div>
        )}
      </div>

      {/* 결과 표시 */}
      {ocrState === 'done' && result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-600 font-semibold">인식 완료</p>
            <p className="text-xl font-mono font-bold text-green-800 tracking-widest">{result}</p>
          </div>
          <button
            onClick={reset}
            className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg active:bg-green-200"
          >
            다시 찍기
          </button>
        </div>
      )}

      {ocrState === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-red-500 font-semibold">인식 실패</p>
            <p className="text-xs text-red-400 font-mono mt-0.5 truncate max-w-[200px]">{ocrText || '번호를 찾지 못했습니다'}</p>
          </div>
          <button
            onClick={reset}
            className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg active:bg-red-200"
          >
            다시 찍기
          </button>
        </div>
      )}

      {/* 셔터 버튼 */}
      {(ocrState === 'idle' || ocrState === 'scanning') && (
        <button
          onClick={capture}
          disabled={!camReady || ocrState === 'scanning'}
          className="w-full py-5 rounded-xl text-lg font-bold bg-gray-900 text-white active:bg-gray-700 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {ocrState === 'scanning' ? '인식 중...' : '📸 촬영'}
        </button>
      )}

      {/* 숨겨진 캔버스 */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
