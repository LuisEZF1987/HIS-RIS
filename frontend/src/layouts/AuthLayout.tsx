import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Sun, Moon } from 'lucide-react'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { theme, toggleTheme } = useUIStore()

  // Sync dark class on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const isDark = theme === 'dark'

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 transition-colors duration-300"
      style={{ backgroundColor: isDark ? '#020617' : '#f1f5f9' }}
    >
      {/* Background */}
      {isDark ? (
        <>
          <div
            className="fixed inset-0 -z-10 bg-cover bg-center"
            style={{
              backgroundImage: "url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2053&auto=format&fit=crop')",
            }}
          />
          <div
            className="fixed inset-0 -z-10"
            style={{ background: 'linear-gradient(135deg, rgba(2,6,23,0.93) 0%, rgba(26,75,153,0.45) 100%)' }}
          />
        </>
      ) : (
        <div
          className="fixed inset-0 -z-10"
          style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 60%, #eff6ff 100%)' }}
        />
      )}

      {/* Theme toggle — top right */}
      <button
        onClick={toggleTheme}
        title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="fixed top-4 right-4 z-50 p-2 rounded-full transition-all duration-200"
        style={{
          background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          color: isDark ? '#fbbf24' : '#475569',
          backdropFilter: 'blur(8px)',
        }}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md">

        {/* Logo + título */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center p-4 rounded-[2rem] mb-5 border shadow-2xl"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(12px)',
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,75,153,0.2)',
            }}
          >
            <img
              src={isDark ? '/logo.png' : '/logo1.png'}
              alt="Dimed"
              className="h-16 w-auto"
            />
          </div>

          <h1
            className="text-4xl font-bold tracking-tight drop-shadow-2xl"
            style={{ color: isDark ? 'white' : '#1e293b' }}
          >
            Dimed <span style={{ color: '#1A4B99' }}>HIS/RIS</span>
          </h1>
          <p
            className="text-xs mt-2 font-bold tracking-widest uppercase"
            style={{
              color: isDark ? '#93c5fd' : '#3b82f6',
              letterSpacing: '0.3em',
            }}
          >
            Sistema de Información Hospitalaria
          </p>
        </div>

        {/* Card con formulario */}
        <div
          className="rounded-[2.5rem] shadow-2xl px-10 py-10"
          style={{
            background: isDark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(26,75,153,0.15)',
          }}
        >
          <Outlet />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: isDark ? '#475569' : '#64748b' }}
          >
            Dimed Healthcare S.A.
          </p>
          <p className="text-xs mt-1" style={{ color: isDark ? '#334155' : '#94a3b8' }}>
            Soporte Técnico Especializado
          </p>
        </div>

      </div>
    </div>
  )
}
