import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { User } from '@/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { UserPlus, Users, ShieldCheck } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const schema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  role: z.enum(['admin', 'receptionist', 'technician', 'radiologist', 'physician']),
})
type FormData = z.infer<typeof schema>

const roleColors: Record<string, string> = {
  admin:        'bg-purple-100 text-purple-700',
  receptionist: 'bg-blue-100 text-blue-700',
  technician:   'bg-yellow-100 text-yellow-700',
  radiologist:  'bg-green-100 text-green-700',
  physician:    'bg-orange-100 text-orange-700',
}

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"

interface AuditEntry {
  id: number
  user_id?: number
  action: string
  resource_type: string
  resource_id?: string
  ip_address?: string
  status_code: number
  created_at: string
}

export default function AdminPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'users' | 'audit'>('users')
  const [showForm, setShowForm] = useState(false)

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.get<User[]>('/admin/users').then(r => r.data),
    enabled: tab === 'users',
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => apiClient.get<AuditEntry[]>('/admin/audit-logs?limit=100').then(r => r.data),
    enabled: tab === 'audit',
    refetchInterval: 10000,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'receptionist' },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiClient.post<User>('/admin/users', data).then(r => r.data),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(`Usuario ${user.username} creado`)
      reset()
      setShowForm(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administración</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de usuarios y auditoría del sistema</p>
        </div>
        {tab === 'users' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'users' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2"><Users className="w-4 h-4" />Usuarios</span>
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'audit' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Auditoría</span>
        </button>
      </div>

      {/* ── Users tab ── */}
      {tab === 'users' && (
        <>
          {showForm && (
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Nuevo Usuario</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Usuario</label>
                  <input {...register('username')} className={inputClass} placeholder="usuario" />
                  {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input {...register('email')} type="email" className={inputClass} />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo</label>
                  <input {...register('full_name')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
                  <input {...register('password')} type="password" className={inputClass} placeholder="Min 8 caracteres" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                  <select {...register('role')} className={inputClass}>
                    <option value="receptionist">Recepcionista</option>
                    <option value="technician">Técnico</option>
                    <option value="radiologist">Radiólogo</option>
                    <option value="physician">Médico</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                  {createMutation.isPending ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Usuario', 'Email', 'Nombre', 'Rol', 'Estado'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(users || []).map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.username}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.full_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors[u.role]}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Audit tab ── */}
      {tab === 'audit' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {!auditLogs?.length ? (
            <div className="p-8 text-center text-gray-500">No hay registros de auditoría aún</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['#', 'Fecha', 'Usuario', 'Acción', 'Recurso', 'IP', 'HTTP'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {auditLogs.map((log) => {
                  const method = log.action.split(':')[0]
                  const methodColors: Record<string, string> = {
                    POST: 'bg-green-100 text-green-700',
                    PUT: 'bg-blue-100 text-blue-700',
                    PATCH: 'bg-yellow-100 text-yellow-700',
                    DELETE: 'bg-red-100 text-red-700',
                  }
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{log.id}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                        {format(parseISO(log.created_at), 'dd/MM HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{log.user_id ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded mr-1 ${methodColors[method] ?? 'bg-gray-100 text-gray-600'}`}>
                          {method}
                        </span>
                        <span className="text-gray-600 font-mono text-xs">{log.action.split(':').slice(1).join(':').replace('/api/v1', '')}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{log.resource_type}{log.resource_id ? `/${log.resource_id}` : ''}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs font-mono">{log.ip_address ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold ${log.status_code < 300 ? 'text-green-600' : log.status_code < 500 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {log.status_code}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
