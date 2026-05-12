import type { Book } from '../types'

interface Props {
  book: Book
  isCurrent?: boolean
  label?: string  // "바로 앞", "3번째" 등
}

export function BookSlot({ book, isCurrent = false, label }: Props) {
  const bgColor = isCurrent
    ? 'bg-blue-600 text-white border-blue-600'
    : book.status === 'checkedOut'
    ? 'bg-gray-100 text-gray-400 border-gray-200'
    : 'bg-white text-gray-800 border-gray-300'

  return (
    <div
      className={`flex flex-col items-center justify-center border-2 rounded-lg p-2 min-h-[80px] flex-1 text-center ${bgColor}`}
    >
      {label && (
        <span className={`text-[9px] font-semibold mb-1 ${isCurrent ? 'text-blue-200' : 'text-gray-400'}`}>
          {label}
        </span>
      )}
      <span className="text-[11px] font-medium leading-tight line-clamp-2">{book.title}</span>
      <span className={`text-[9px] mt-1 ${isCurrent ? 'text-blue-200' : book.status === 'checkedOut' ? 'text-red-400' : 'text-green-600'}`}>
        {isCurrent ? book.callNumber : book.status === 'checkedOut' ? '대출중' : '대출가능'}
      </span>
    </div>
  )
}
