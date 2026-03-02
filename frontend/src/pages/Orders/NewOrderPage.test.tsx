import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen } from '@/test/utils'
import NewOrderPage from './NewOrderPage'

vi.mock('@/api/orders', () => ({
  ordersApi: { create: vi.fn() },
}))

vi.mock('@/api/patients', () => ({
  patientsApi: { list: vi.fn().mockResolvedValue({ items: [], total: 0 }), get: vi.fn() },
}))

vi.mock('@/api/schedule', () => ({
  scheduleApi: { getResources: vi.fn().mockResolvedValue([]) },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

describe('NewOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form title', () => {
    renderWithProviders(<NewOrderPage />)
    expect(screen.getByText('Nueva Orden de Imagen')).toBeInTheDocument()
  })

  it('has modality select with options', () => {
    renderWithProviders(<NewOrderPage />)
    // The select is rendered as a native <select> with name="modality"
    const selects = document.querySelectorAll('select')
    const modalitySelect = Array.from(selects).find(s => s.name === 'modality')
    expect(modalitySelect).toBeTruthy()
    expect(modalitySelect!.querySelectorAll('option').length).toBeGreaterThan(5)
  })

  it('has priority select with options', () => {
    renderWithProviders(<NewOrderPage />)
    const selects = document.querySelectorAll('select')
    const prioritySelect = Array.from(selects).find(s => s.name === 'priority')
    expect(prioritySelect).toBeTruthy()
    // Should have ROUTINE, URGENT, STAT, ASAP
    const options = Array.from(prioritySelect!.querySelectorAll('option'))
    expect(options.some(o => o.textContent === 'Rutina')).toBe(true)
    expect(options.some(o => o.textContent === 'Urgente')).toBe(true)
  })

  it('has procedure description input', () => {
    renderWithProviders(<NewOrderPage />)
    expect(screen.getByPlaceholderText(/radiografía de tórax/i)).toBeInTheDocument()
  })

  it('has patient search field', () => {
    renderWithProviders(<NewOrderPage />)
    expect(screen.getByPlaceholderText(/buscar por nombre/i)).toBeInTheDocument()
  })

  it('has submit button', () => {
    renderWithProviders(<NewOrderPage />)
    expect(screen.getByRole('button', { name: /crear orden/i })).toBeInTheDocument()
  })

  it('has cancel button', () => {
    renderWithProviders(<NewOrderPage />)
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })
})
