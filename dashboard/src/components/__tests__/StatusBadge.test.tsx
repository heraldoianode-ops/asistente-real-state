import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

describe('StatusBadge', () => {
  it('renders label text', () => {
    render(<StatusBadge label="Activo" variant="active" />)
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('applies active styles', () => {
    render(<StatusBadge label="Activo" variant="active" />)
    const badge = screen.getByTestId('badge-Activo')
    expect(badge.className).toContain('status-active')
  })

  it('applies inactive styles', () => {
    render(<StatusBadge label="Inactivo" variant="inactive" />)
    const badge = screen.getByTestId('badge-Inactivo')
    expect(badge.className).toContain('status-inactive')
  })

  it('applies pending styles', () => {
    render(<StatusBadge label="Pendiente" variant="pending" />)
    const badge = screen.getByTestId('badge-Pendiente')
    expect(badge.className).toContain('status-pending')
  })

  it('resolves variant from active boolean', () => {
    render(<StatusBadge label="Test" active={true} />)
    const badge = screen.getByTestId('badge-Test')
    expect(badge.className).toContain('status-active')
  })

  it('resolves inactive from active=false', () => {
    render(<StatusBadge label="Test" active={false} />)
    const badge = screen.getByTestId('badge-Test')
    expect(badge.className).toContain('status-inactive')
  })
})
