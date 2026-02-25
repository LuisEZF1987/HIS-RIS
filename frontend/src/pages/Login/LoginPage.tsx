import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff } from 'lucide-react'

const schema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
})
type FormData = z.infer<typeof schema>

const labelClass = 'block text-[10px] font-bold uppercase tracking-widest mb-2 ml-1'
const inputClass = `
  w-full pl-11 pr-4 py-4 rounded-2xl text-white placeholder-slate-500
  focus:outline-none transition
`.trim()

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const tokens = await authApi.login(data.username, data.password)
      setTokens(tokens.access_token, tokens.refresh_token)
      const user = await authApi.me()
      setUser(user)
      toast.success(`Bienvenido, ${user.full_name}`)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Credenciales inválidas')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Usuario */}
      <div>
        <label className={labelClass} style={{ color: '#94a3b8' }}>Usuario</label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center" style={{ color: '#64748b' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </span>
          <input
            {...register('username')}
            type="text"
            placeholder="usuario"
            autoComplete="username"
            className={inputClass}
            style={{
              background: 'rgba(2,6,23,0.6)',
              border: errors.username ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
            }}
            onFocus={(e) => { e.target.style.border = '1px solid #1A4B99'; e.target.style.boxShadow = '0 0 0 4px rgba(26,75,153,0.3)'; }}
            onBlur={(e)  => { e.target.style.border = errors.username ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        {errors.username && <p className="text-red-400 text-xs mt-1 ml-1">{errors.username.message}</p>}
      </div>

      {/* Contraseña */}
      <div>
        <label className={labelClass} style={{ color: '#94a3b8' }}>Contraseña</label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center" style={{ color: '#64748b' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.8-2.2-5-5-5S7 3.2 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.7 1.4-3.1 3.1-3.1 1.7 0 3.1 1.4 3.1 3.1v2z"/>
            </svg>
          </span>
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            className={`${inputClass} pr-12`}
            style={{
              background: 'rgba(2,6,23,0.6)',
              border: errors.password ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
            }}
            onFocus={(e) => { e.target.style.border = '1px solid #1A4B99'; e.target.style.boxShadow = '0 0 0 4px rgba(26,75,153,0.3)'; }}
            onBlur={(e)  => { e.target.style.border = errors.password ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center"
            style={{ color: '#64748b' }}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-red-400 text-xs mt-1 ml-1">{errors.password.message}</p>}
      </div>

      {/* Botón */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 text-white rounded-2xl font-bold text-sm tracking-widest uppercase shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#1A4B99' }}
        onMouseEnter={(e) => { if (!isSubmitting) { (e.target as HTMLElement).style.background = '#153d7a'; (e.target as HTMLElement).style.transform = 'translateY(-2px)'; (e.target as HTMLElement).style.boxShadow = '0 10px 25px rgba(26,75,153,0.5)'; }}}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#1A4B99'; (e.target as HTMLElement).style.transform = ''; (e.target as HTMLElement).style.boxShadow = ''; }}
      >
        {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
      </button>

      {/* Separador */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem' }}>
        <p className="text-center text-xs" style={{ color: '#475569' }}>
          ¿Problemas para acceder? Contacte al administrador del sistema.
        </p>
      </div>

    </form>
  )
}
