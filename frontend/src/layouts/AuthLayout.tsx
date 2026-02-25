import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#020617' }}>

      {/* Fondo médico */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2053&auto=format&fit=crop')",
        }}
      />
      {/* Overlay gradiente */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(135deg, rgba(2,6,23,0.93) 0%, rgba(26,75,153,0.45) 100%)',
        }}
      />

      <div className="w-full max-w-md">

        {/* Logo + título */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center p-4 rounded-[2rem] mb-5 border shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <img src="/logo.png" alt="Dimed" className="h-16 w-auto" />
          </div>

          <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-2xl">
            Dimed <span style={{ color: '#1A4B99' }}>HIS/RIS</span>
          </h1>
          <p
            className="text-xs mt-2 font-bold tracking-widest uppercase"
            style={{ color: '#93c5fd', letterSpacing: '0.3em' }}
          >
            Sistema de Información Hospitalaria
          </p>
        </div>

        {/* Card con formulario */}
        <div
          className="rounded-[2.5rem] shadow-2xl px-10 py-10"
          style={{
            background: 'rgba(15,23,42,0.78)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Outlet />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#475569' }}>
            Dimed Healthcare S.A.
          </p>
          <p className="text-xs mt-1" style={{ color: '#334155' }}>
            Soporte Técnico Especializado
          </p>
        </div>

      </div>
    </div>
  )
}
