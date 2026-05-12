export interface Book {
  id: string          // 등록번호
  title: string       // 자료명
  author: string      // 저자
  callNumber: string  // 청구기호
  status: 'available' | 'checkedOut'  // 대출가능 / 대출중
}

export interface ShelfResult {
  current: Book
  before: Book[]  // 앞 3권, index 0 = 바로 앞
  after: Book[]   // 뒤 3권, index 0 = 바로 뒤
}
