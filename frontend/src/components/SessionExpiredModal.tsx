import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '@/store/sessionStore'
import { useAuthStore } from '@/store/authStore'
import { ShieldAlert } from 'lucide-react'

export default function SessionExpiredModal() {
  const { showExpiredModal, setShowExpiredModal } = useSessionStore()
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  if (!showExpiredModal) return null

  const handleLogin = () => {
    setShowExpiredModal(false)
    logout()
    navigate('/login')
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm text-center p-6">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Sesión Expirada</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Su sesión ha expirado por inactividad. Por favor, inicie sesión nuevamente para continuar.
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Iniciar Sesión
        </button>
      </div>
    </div>
  )
}
