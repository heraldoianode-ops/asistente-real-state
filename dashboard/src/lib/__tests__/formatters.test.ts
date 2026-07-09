import { describe, it, expect } from 'vitest'
import { getPropLabel, getAgentName, pickFirst, formatMoney, initialsOf, STAGE_LABEL, PROPERTY_TYPE_LABEL } from '../formatters'

describe('pickFirst', () => {
  it('returns null for null', () => expect(pickFirst(null)).toBeNull())
  it('returns null for empty array', () => expect(pickFirst([])).toBeNull())
  it('returns object directly when not array', () => {
    const obj = { a: 1 }
    expect(pickFirst(obj)).toBe(obj)
  })
  it('returns first element of array', () => {
    expect(pickFirst([{ a: 1 }, { a: 2 }])).toEqual({ a: 1 })
  })
})

describe('getPropLabel', () => {
  it('returns — for null', () => expect(getPropLabel(null)).toBe('—'))
  it('returns address when present', () =>
    expect(getPropLabel({ address: 'Av. Corrientes 1234', neighborhood: null })).toBe('Av. Corrientes 1234'))
  it('falls back to neighborhood when no address', () =>
    expect(getPropLabel({ address: null, neighborhood: 'Palermo' })).toBe('Palermo'))
  it('returns — when both null', () =>
    expect(getPropLabel({ address: null, neighborhood: null })).toBe('—'))
  it('handles Supabase array join format', () =>
    expect(getPropLabel([{ address: 'Belgrano 500', neighborhood: 'Belgrano' }])).toBe('Belgrano 500'))
  it('returns — for empty array', () =>
    expect(getPropLabel([])).toBe('—'))
})

describe('getAgentName', () => {
  it('returns — for null', () => expect(getAgentName(null)).toBe('—'))
  it('returns name from object', () =>
    expect(getAgentName({ full_name: 'Juan Perez' })).toBe('Juan Perez'))
  it('returns name from array (Supabase join)', () =>
    expect(getAgentName([{ full_name: 'Maria Lopez' }])).toBe('Maria Lopez'))
  it('returns — when full_name is null', () =>
    expect(getAgentName({ full_name: null })).toBe('—'))
})

describe('formatMoney', () => {
  it('formats with default USD currency', () => expect(formatMoney(150000)).toBe('USD 150.000'))
  it('formats with a given currency', () => expect(formatMoney(900, 'ARS')).toBe('ARS 900'))
})

describe('initialsOf', () => {
  it('returns first letters of first two words', () => expect(initialsOf('Laura Gómez')).toBe('LG'))
  it('falls back to first two chars for single word', () => expect(initialsOf('Cliente')).toBe('CL'))
})

describe('STAGE_LABEL / PROPERTY_TYPE_LABEL', () => {
  it('maps known lead stages', () => expect(STAGE_LABEL.qualified).toBe('Calificado'))
  it('maps known property types', () => expect(PROPERTY_TYPE_LABEL.apartment).toBe('Departamento'))
})
