import type { ShelfResult } from '../types'
import { BookSlot } from './BookSlot'

interface Props {
  result: ShelfResult
}

// before[0]이 바로 앞, after[0]이 바로 뒤이므로
// 화면 왼쪽→오른쪽: before 역순(before[2], before[1], before[0]) + current + after[0], after[1], after[2]
export function ShelfView({ result }: Props) {
  const { current, before, after } = result

  // 왼쪽 슬롯: 앞 3권을 멀리→가까이 순으로 (before[2] → before[1] → before[0])
  const leftSlots = [...before].reverse()
  // 빈 슬롯 채우기 (앞 책이 3권 미만일 때)
  const leftPadded = Array(3 - leftSlots.length).fill(null).concat(leftSlots)

  // 오른쪽 슬롯: 뒤 3권 (after[0] → after[1] → after[2])
  const rightPadded = [...after, ...Array(3 - after.length).fill(null)]

  const beforeLabels = ['3번째 앞', '2번째 앞', '바로 앞']
  const afterLabels = ['바로 뒤', '2번째 뒤', '3번째 뒤']

  return (
    <div className="w-full">
      {/* 선반 시각화 */}
      <div className="bg-amber-900 rounded-lg p-2">
        <div className="bg-amber-100 rounded-md p-2 flex gap-1 items-stretch">
          {leftPadded.map((book, i) =>
            book ? (
              <BookSlot key={book.id} book={book} label={beforeLabels[i]} />
            ) : (
              <div key={`empty-left-${i}`} className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-amber-200" />
            )
          )}

          {/* 현재 책 슬롯 */}
          <BookSlot book={current} isCurrent />

          {rightPadded.map((book, i) =>
            book ? (
              <BookSlot key={book.id} book={book} label={afterLabels[i]} />
            ) : (
              <div key={`empty-right-${i}`} className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-amber-200" />
            )
          )}
        </div>
        {/* 선반 하단 */}
        <div className="bg-amber-950 h-2 rounded-b-md mt-1" />
      </div>

      {/* 현재 책 정보 */}
      <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-xs text-blue-500 font-semibold mb-1">📖 지금 정리할 책</p>
        <p className="font-bold text-gray-900">{current.title}</p>
        <p className="text-sm text-gray-500">{current.callNumber}</p>
      </div>

      {/* 바로 앞/뒤 텍스트 요약 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <p className="text-xs text-amber-600 font-semibold mb-1">← 바로 앞</p>
          {before[0] ? (
            <>
              <p className="text-sm font-medium text-gray-800">{before[0].title}</p>
              <p className={`text-xs mt-0.5 ${before[0].status === 'checkedOut' ? 'text-red-500' : 'text-green-600'}`}>
                {before[0].status === 'checkedOut' ? '대출중' : '대출가능'}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">첫 번째 책</p>
          )}
        </div>
        <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-200">
          <p className="text-xs text-cyan-600 font-semibold mb-1">바로 뒤 →</p>
          {after[0] ? (
            <>
              <p className="text-sm font-medium text-gray-800">{after[0].title}</p>
              <p className={`text-xs mt-0.5 ${after[0].status === 'checkedOut' ? 'text-red-500' : 'text-green-600'}`}>
                {after[0].status === 'checkedOut' ? '대출중' : '대출가능'}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">마지막 책</p>
          )}
        </div>
      </div>
    </div>
  )
}
