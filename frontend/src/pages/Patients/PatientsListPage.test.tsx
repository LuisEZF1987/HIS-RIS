import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen, waitFor } from '@/test/utils'
import PatientsListPage from './PatientsListPage'
import { patientsApi } from '@/api/patients'

// Mock patient API
vi.mock('@/api/patients', () => ({
  patientsApi: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  },
}))

vi.mock('@/api/export', () => ({
  exportApi: { patients: vi.fn() },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const mockedList = vi.mocked(patientsApi.list)

const mockPatients = {
  items: [
    { id: 1, mrn: 'MRN-001', full_name: 'Juan Pérez', date_of_birth: '1990-01-15', gender: 'M' as const, dni: '12345', is_active: true },
    { id: 2, mrn: 'MRN-002', full_name: 'María García', date_of_birth: '1985-06-20', gender: 'F' as const, dni: '67890', is_active: true },
  ],
  total: 2,
  page: 1,
  page_size: 20,
  pages: 1,
}

describe('PatientsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockedList.mockReturnValue(new Promise(() => {})) // Never resolves
    renderWithProviders(<PatientsListPage />)
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('displays patients after loading', async () => {
    mockedList.mockResolvedValue(mockPatients)

    renderWithProviders(<PatientsListPage />)

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
      expect(screen.getByText('María García')).toBeInTheDocument()
    })
  })

  it('shows patient count', async () => {
    mockedList.mockResolvedValue(mockPatients)

    renderWithProviders(<PatientsListPage />)

    await waitFor(() => {
      expect(screen.getByText('2 pacientes registrados')).toBeInTheDocument()
    })
  })

  it('has search input', () => {
    mockedList.mockResolvedValue(mockPatients)

    renderWithProviders(<PatientsListPage />)

    expect(screen.getByPlaceholderText(/buscar por nombre/i)).toBeInTheDocument()
  })

  it('shows empty state when no patients', async () => {
    mockedList.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })

    renderWithProviders(<PatientsListPage />)

    await waitFor(() => {
      expect(screen.getByText('No se encontraron pacientes')).toBeInTheDocument()
    })
  })
})
