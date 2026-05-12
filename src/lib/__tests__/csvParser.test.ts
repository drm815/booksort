import { describe, it, expect } from 'vitest'
import { parseBooks } from '../csvParser'

const SAMPLE_CSV = `번호,등록번호,자료명,저자,출판사,출판년도,청구기호,등록일,자료상태,소장처
1,1000001,채식주의자,한강,창비,2007,813.6-한17ㅊ,2020-01-01,대출가능,본관
2,1000002,작별하지 않는다,한강,문학동네,2021,813.6-한17ㅈ,2022-03-01,대출중,본관
3,1000003,82년생 김지영,조남주,민음사,2016,813.6-조211ㅍ,2019-05-01,대출가능,본관`

describe('parseBooks', () => {
  it('CSV 텍스트를 Book 배열로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books).toHaveLength(3)
  })

  it('등록번호를 id로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[0].id).toBe('1000001')
  })

  it('자료명을 title로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[0].title).toBe('채식주의자')
  })

  it('청구기호를 callNumber로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[0].callNumber).toBe('813.6-한17ㅊ')
  })

  it('대출가능을 available로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[0].status).toBe('available')
  })

  it('대출중을 checkedOut으로 파싱한다', () => {
    const books = parseBooks(SAMPLE_CSV)
    expect(books[1].status).toBe('checkedOut')
  })

  it('빈 CSV는 빈 배열을 반환한다', () => {
    const books = parseBooks('번호,등록번호,자료명,저자,출판사,출판년도,청구기호,등록일,자료상태,소장처\n')
    expect(books).toHaveLength(0)
  })

  it('헤더만 있는 CSV는 빈 배열을 반환한다', () => {
    const books = parseBooks('번호,등록번호,자료명,저자,출판사,출판년도,청구기호,등록일,자료상태,소장처')
    expect(books).toHaveLength(0)
  })
})
