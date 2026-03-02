import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils'
import LoginPage from './LoginPage'

// Mock auth API
vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
  },
}))

// Mock react-router navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form with username and password fields', () => {
    renderWithProviders(<LoginPage />)

    expect(screen.getByPlaceholderText('usuario')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('shows validation errors when submitting empty form', async () => {
    renderWithProviders(<LoginPage />)

    const submitBtn = screen.getByRole('button', { name: /iniciar sesión/i })
    await userEvent.setup().click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Usuario requerido')).toBeInTheDocument()
      expect(screen.getByText('Contraseña requerida')).toBeInTheDocument()
    })
  })

  it('submits credentials and navigates on success', async () => {
    const { authApi } = await import('@/api/auth')
    const mockedLogin = vi.mocked(authApi.login)
    const mockedMe = vi.mocked(authApi.me)

    mockedLogin.mockResolvedValueOnce({
      access_token: 'tok', refresh_token: 'ref', token_type: 'bearer', expires_in: 3600,
    })
    mockedMe.mockResolvedValueOnce({
      id: 1, username: 'admin', email: 'a@b.com', full_name: 'Admin',
      role: 'admin', is_active: true, created_at: '2025-01-01',
    })

    renderWithProviders(<LoginPage />)
    const user = userEvent.setup()

    await user.type(screen.getByPlaceholderText('usuario'), 'admin')
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith('admin', 'secret123')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('toggles password visibility', async () => {
    renderWithProviders(<LoginPage />)
    const user = userEvent.setup()

    const passwordInput = screen.getByPlaceholderText('••••••••')
    expect(passwordInput).toHaveAttribute('type', 'password')

    // Click the toggle button (the one with Eye/EyeOff icon)
    const toggleBtns = screen.getAllByRole('button')
    const toggleBtn = toggleBtns.find(b => b.getAttribute('type') === 'button')!
    await user.click(toggleBtn)

    expect(passwordInput).toHaveAttribute('type', 'text')
  })
})
