import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  })

  it('starts with unauthenticated state', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
  })

  it('sets tokens and marks as authenticated', () => {
    useAuthStore.getState().setTokens('access-123', 'refresh-456')

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('access-123')
    expect(state.refreshToken).toBe('refresh-456')
    expect(state.isAuthenticated).toBe(true)
  })

  it('sets user and marks as authenticated', () => {
    const mockUser = {
      id: 1,
      username: 'admin',
      email: 'admin@test.com',
      full_name: 'Admin User',
      role: 'admin' as const,
      is_active: true,
      created_at: '2025-01-01',
    }

    useAuthStore.getState().setUser(mockUser)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('logout clears all state', () => {
    // First authenticate
    useAuthStore.getState().setTokens('tok', 'ref')
    useAuthStore.getState().setUser({
      id: 1, username: 'admin', email: 'a@b.com', full_name: 'Admin',
      role: 'admin', is_active: true, created_at: '2025-01-01',
    })

    // Then logout
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setTokens and setUser can be called in sequence', () => {
    const store = useAuthStore.getState()

    store.setTokens('access', 'refresh')
    store.setUser({
      id: 5, username: 'tech', email: 't@t.com', full_name: 'Tech User',
      role: 'technician', is_active: true, created_at: '2025-06-01',
    })

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.accessToken).toBe('access')
    expect(state.user?.role).toBe('technician')
  })
})
