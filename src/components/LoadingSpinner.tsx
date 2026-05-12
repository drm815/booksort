export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">도서목록 불러오는 중...</p>
    </div>
  )
}
