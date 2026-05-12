import { describe, it, expect } from 'vitest'
import { findShelfNeighbors } from '../shelfFinder'
import type { Book } from '../../types'

const makeBook = (id: string, callNumber: string): Book => ({
  id, title: `책${id}`, author: '', callNumber, status: 'available'
})

// 7권: id 1~7, 청구기호 순 정렬 상태
const BOOKS: Book[] = [
  makeBook('1', '100-가'),
  makeBook('2', '200-가'),
  makeBook('3', '300-가'),
  makeBook('4', '400-가'),
  makeBook('5', '500-가'),
  makeBook('6', '600-가'),
  makeBook('7', '700-가'),
]

describe('findShelfNeighbors', () => {
  it('중간 책의 앞 3권 뒤 3권을 반환한다', () => {
    const result = findShelfNeighbors(BOOKS, '4')
    expect(result).not.toBeNull()
    expect(result!.current.id).toBe('4')
    expect(result!.before.map(b => b.id)).toEqual(['3', '2', '1'])
    expect(result!.after.map(b => b.id)).toEqual(['5', '6', '7'])
  })

  it('before[0]이 바로 앞 책이다', () => {
    const result = findShelfNeighbors(BOOKS, '4')
    expect(result!.before[0].id).toBe('3')
  })

  it('after[0]이 바로 뒤 책이다', () => {
    const result = findShelfNeighbors(BOOKS, '4')
    expect(result!.after[0].id).toBe('5')
  })

  it('앞 책이 2권뿐이면 2권만 반환한다', () => {
    const result = findShelfNeighbors(BOOKS, '2')
    expect(result!.before).toHaveLength(1)
    expect(result!.before[0].id).toBe('1')
  })

  it('뒤 책이 2권뿐이면 2권만 반환한다', () => {
    const result = findShelfNeighbors(BOOKS, '6')
    expect(result!.after).toHaveLength(1)
    expect(result!.after[0].id).toBe('7')
  })

  it('첫 번째 책이면 before는 빈 배열이다', () => {
    const result = findShelfNeighbors(BOOKS, '1')
    expect(result!.before).toHaveLength(0)
  })

  it('마지막 책이면 after는 빈 배열이다', () => {
    const result = findShelfNeighbors(BOOKS, '7')
    expect(result!.after).toHaveLength(0)
  })

  it('존재하지 않는 등록번호는 null을 반환한다', () => {
    const result = findShelfNeighbors(BOOKS, '999')
    expect(result).toBeNull()
  })
})
