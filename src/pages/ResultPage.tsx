import type { ShelfResult } from '../types'
import { ShelfView } from '../components/ShelfView'

interface Props {
  result: ShelfResult
  onBack: () => void
}

export function ResultPage({ result, onBack }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-white text-lg leading-none">←</button>
        <h1 className="font-bold">스캔 결과</h1>
      </header>
      <main className="flex-1 px-4 py-4">
        <ShelfView result={result} />
      </main>
    </div>
  )
}
