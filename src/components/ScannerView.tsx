import { useScanner } from '../hooks/useScanner'

interface Props {
  onScan: (bookId: string) => void
}

export function ScannerView({ onScan }: Props) {
  const { videoRef, error, status } = useScanner({ onScan })

  if (error) {
    return (
      <div className="w-full aspect-[4/3] bg-gray-900 rounded-xl flex items-center justify-center">
        <p className="text-white text-sm text-center px-6">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
      {/* 상태 표시 */}
      <div className="absolute top-2 left-0 right-0 flex justify-center">
        <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">{status}</span>
      </div>
      {/* 스캔 가이드 박스 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2/3 h-1/3 relative">
          {/* 모서리 표시 */}
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-green-400 rounded-tl" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-green-400 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-green-400 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-green-400 rounded-br" />
          {/* 스캔 라인 */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-green-400 opacity-70" />
        </div>
      </div>
      <p className="absolute bottom-3 left-0 right-0 text-center text-white text-xs opacity-70">
        바코드를 스캔 영역에 맞춰주세요
      </p>
    </div>
  )
}
