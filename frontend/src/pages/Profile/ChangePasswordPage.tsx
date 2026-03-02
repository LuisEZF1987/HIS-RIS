import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import toast from 'react-hot-toast'
import { Lock, Save } from 'lucide-react'

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg ' +
  'focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ' +
  'placeholder-gray-400 dark:placeholder-slate-500'

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'

interface PasswordForm {
  current_password: string
  new_password: string
  confirm_password: string
}

export default function ChangePasswordPage() {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PasswordForm>()
  const newPassword = watch('new_password')

  const mutation = useMutation({
    mutationFn: (data: PasswordForm) => authApi.changePassword(data.current_password, data.new_password),
    onSuccess: () => {
      toast.success('Contraseña actualizada exitosamente')
      reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al cambiar contraseña'),
  })

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cambiar Contraseña</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Actualice su contraseña de acceso al sistema</p>
      </div>

      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-4"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-700">
          <div className="w-10 h-10 bg-primary-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Ingrese su contraseña actual y la nueva contraseña deseada.
          </p>
        </div>

        <div>
          <label className={labelClass}>Contraseña Actual</label>
          <input
            type="password"
            {...register('current_password', { required: 'Requerido' })}
            className={inputClass}
            placeholder="Ingrese su contraseña actual"
          />
          {errors.current_password && <p className="text-red-500 text-xs mt-1">{errors.current_password.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Nueva Contraseña</label>
          <input
            type="password"
            {...register('new_password', { required: 'Requerido', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })}
            className={inputClass}
            placeholder="Mínimo 8 caracteres"
          />
          {errors.new_password && <p className="text-red-500 text-xs mt-1">{errors.new_password.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Confirmar Nueva Contraseña</label>
          <input
            type="password"
            {...register('confirm_password', {
              required: 'Requerido',
              validate: (v) => v === newPassword || 'Las contraseñas no coinciden',
            })}
            className={inputClass}
            placeholder="Repita la nueva contraseña"
          />
          {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? 'Actualizando...' : 'Actualizar Contraseña'}
        </button>
      </form>
    </div>
  )
}
