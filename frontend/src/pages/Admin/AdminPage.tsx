import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { scheduleApi } from '@/api/schedule'
import type { User, Resource } from '@/types'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { UserPlus, Users, ShieldCheck, Monitor, Plus, Pencil, ToggleLeft, ToggleRight, X } from 'lucide-react'
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
  admin:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  receptionist: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  technician:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  radiologist:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  physician:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg ' +
  'focus:ring-2 focus:ring-primary-500 outline-none text-sm ' +
  'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100'

const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'

const resourceSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  resource_type: z.enum(['room', 'equipment', 'staff']),
  modality: z.string().optional(),
  ae_title: z.string().optional(),
  location: z.string().optional(),
  operating_start_hour: z.number({ coerce: true }).min(0).max(23).default(0),
  operating_end_hour: z.number({ coerce: true }).min(1).max(24).default(24),
})
type ResourceFormData = z.infer<typeof resourceSchema>

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
  const [tab, setTab] = useState<'users' | 'resources' | 'audit'>('users')
  const [showForm, setShowForm] = useState(false)
  const [showResourceForm, setShowResourceForm] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.get<User[]>('/admin/users').then((r) => r.data),
    enabled: tab === 'users',
  })

  const { data: resources } = useQuery({
    queryKey: ['resources'],
    queryFn: () => scheduleApi.getResources(),
    enabled: tab === 'resources',
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => apiClient.get<AuditEntry[]>('/admin/audit-logs?limit=100').then((r) => r.data),
    enabled: tab === 'audit',
    refetchInterval: 10000,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'receptionist' },
  })

  const { register: regResource, handleSubmit: submitResource, reset: resetResource, formState: { errors: resErrors } } = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
    defaultValues: { resource_type: 'equipment', operating_start_hour: 0, operating_end_hour: 24 },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiClient.post<User>('/admin/users', data).then((r) => r.data),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(`Usuario ${user.username} creado`)
      reset()
      setShowForm(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error'),
  })

  const createResourceMutation = useMutation({
    mutationFn: (data: ResourceFormData) =>
      apiClient.post('/resources', {
        ...data,
        modality: data.modality || undefined,
        ae_title: data.ae_title || undefined,
        location: data.location || undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      toast.success('Equipo/Sala creado exitosamente')
      resetResource()
      setShowResourceForm(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al crear recurso'),
  })

  const {
    register: regEditResource,
    handleSubmit: submitEditResource,
    reset: resetEditResource,
    formState: { errors: editResErrors },
  } = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
  })

  const openEditModal = (r: Resource) => {
    setEditingResource(r)
    resetEditResource({
      name: r.name,
      resource_type: r.resource_type as 'room' | 'equipment' | 'staff',
      modality: r.modality || '',
      ae_title: r.ae_title || '',
      location: r.location || '',
      operating_start_hour: r.operating_start_hour,
      operating_end_hour: r.operating_end_hour,
    })
  }

  const updateResourceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Resource> }) =>
      scheduleApi.updateResource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      toast.success('Equipo actualizado')
      setEditingResource(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al actualizar'),
  })

  const toggleAvailability = (r: Resource) => {
    updateResourceMutation.mutate({ id: r.id, data: { is_available: !r.is_available } })
  }

  const tabBtn = (id: typeof tab, label: string, Icon: any) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        tab === id
          ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-white'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
      }`}
    >
      <span className="flex items-center gap-2"><Icon className="w-4 h-4" />{label}</span>
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Administración</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Gestión de usuarios, equipos y auditoría del sistema</p>
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
        {tab === 'resources' && (
          <button
            onClick={() => setShowResourceForm(!showResourceForm)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo Equipo / Sala
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 p-1 rounded-lg w-fit">
        {tabBtn('users', 'Usuarios', Users)}
        {tabBtn('resources', 'Equipos', Monitor)}
        {tabBtn('audit', 'Auditoría', ShieldCheck)}
      </div>

      {/* ── Users tab ── */}
      {tab === 'users' && (
        <>
          {showForm && (
            <form
              onSubmit={handleSubmit((d) => createMutation.mutate(d))}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-4"
            >
              <h2 className="font-semibold text-gray-900 dark:text-white">Nuevo Usuario</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Usuario</label>
                  <input {...register('username')} className={inputClass} placeholder="usuario" />
                  {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input {...register('email')} type="email" className={inputClass} />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Nombre Completo</label>
                  <input {...register('full_name')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Contraseña</label>
                  <input {...register('password')} type="password" className={inputClass} placeholder="Min 8 caracteres" />
                </div>
                <div>
                  <label className={labelClass}>Rol</label>
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
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                <tr>
                  {['Usuario', 'Email', 'Nombre', 'Rol', 'Estado'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {(users || []).map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{u.username}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{u.full_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors[u.role]}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
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

      {/* ── Resources tab ── */}
      {tab === 'resources' && (
        <>
          {showResourceForm && (
            <form
              onSubmit={submitResource((d) => createResourceMutation.mutate(d))}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-4"
            >
              <h2 className="font-semibold text-gray-900 dark:text-white">Nuevo Equipo / Sala</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre *</label>
                  <input {...regResource('name')} className={inputClass} placeholder="Ej: CT1, Sala Ecografía" />
                  {resErrors.name && <p className="text-red-500 text-xs mt-1">{resErrors.name.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select {...regResource('resource_type')} className={inputClass}>
                    <option value="equipment">Equipo</option>
                    <option value="room">Sala</option>
                    <option value="staff">Personal</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Modalidad DICOM</label>
                  <select {...regResource('modality')} className={inputClass}>
                    <option value="">— Ninguna —</option>
                    {['CR', 'CT', 'MR', 'US', 'NM', 'DX', 'MG', 'XA', 'RF', 'OT'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>AE Title DICOM</label>
                  <input {...regResource('ae_title')} className={inputClass} placeholder="Ej: CT_SCANNER_1" />
                </div>
                <div>
                  <label className={labelClass}>Ubicación</label>
                  <input {...regResource('location')} className={inputClass} placeholder="Ej: Planta Baja, Sala 3" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Hora inicio</label>
                    <input {...regResource('operating_start_hour')} type="number" min={0} max={23} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Hora fin</label>
                    <input {...regResource('operating_end_hour')} type="number" min={1} max={24} className={inputClass} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">Horario de operación: 0-24 = 24 horas. Ej: 8 a 20 = 8am a 8pm.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowResourceForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={createResourceMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                  {createResourceMutation.isPending ? 'Creando...' : 'Crear Equipo'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            {!resources?.length ? (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                <Monitor className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                <p>No hay equipos registrados</p>
                <p className="text-xs mt-1">Haga clic en "Nuevo Equipo / Sala" para agregar uno</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                  <tr>
                    {['Nombre', 'Tipo', 'Modalidad', 'AE Title', 'Ubicación', 'Horario', 'Estado', 'Acciones'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                  {resources.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{r.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 capitalize">{r.resource_type}</td>
                      <td className="px-4 py-3">
                        {r.modality ? (
                          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded">{r.modality}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-slate-400">{r.ae_title || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{r.location || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                        {r.operating_start_hour}:00 - {r.operating_end_hour}:00
                        {r.operating_start_hour === 0 && r.operating_end_hour === 24 && ' (24h)'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.is_available ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {r.is_available ? 'Disponible' : 'No disponible'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(r)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleAvailability(r)}
                            disabled={updateResourceMutation.isPending}
                            className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 ${r.is_available ? 'text-green-600 dark:text-green-400 hover:text-red-600 dark:hover:text-red-400' : 'text-red-500 dark:text-red-400 hover:text-green-600 dark:hover:text-green-400'}`}
                            title={r.is_available ? 'Deshabilitar' : 'Habilitar'}
                          >
                            {r.is_available ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Edit Resource Modal */}
      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar Equipo / Sala</h2>
              <button onClick={() => setEditingResource(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={submitEditResource((d) =>
                updateResourceMutation.mutate({
                  id: editingResource.id,
                  data: {
                    ...d,
                    modality: d.modality || undefined,
                    ae_title: d.ae_title || undefined,
                    location: d.location || undefined,
                  },
                })
              )}
              className="px-6 py-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre *</label>
                  <input {...regEditResource('name')} className={inputClass} />
                  {editResErrors.name && <p className="text-red-500 text-xs mt-1">{editResErrors.name.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select {...regEditResource('resource_type')} className={inputClass}>
                    <option value="equipment">Equipo</option>
                    <option value="room">Sala</option>
                    <option value="staff">Personal</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Modalidad DICOM</label>
                  <select {...regEditResource('modality')} className={inputClass}>
                    <option value="">— Ninguna —</option>
                    {['CR', 'CT', 'MR', 'US', 'NM', 'DX', 'MG', 'XA', 'RF', 'OT'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>AE Title DICOM</label>
                  <input {...regEditResource('ae_title')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Ubicación</label>
                  <input {...regEditResource('location')} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Hora inicio</label>
                    <input {...regEditResource('operating_start_hour')} type="number" min={0} max={23} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Hora fin</label>
                    <input {...regEditResource('operating_end_hour')} type="number" min={1} max={24} className={inputClass} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingResource(null)}
                  className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-medium text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={updateResourceMutation.isPending}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm">
                  {updateResourceMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Audit tab ── */}
      {tab === 'audit' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          {!auditLogs?.length ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">No hay registros de auditoría aún</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                <tr>
                  {['#', 'Fecha', 'Usuario', 'Acción', 'Recurso', 'IP', 'HTTP'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-3 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {auditLogs.map((log) => {
                  const method = log.action.split(':')[0]
                  const methodColors: Record<string, string> = {
                    POST:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    PUT:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                    PATCH:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  }
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-3 py-2 text-gray-400 dark:text-slate-500 text-xs">{log.id}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-slate-400 text-xs whitespace-nowrap">
                        {format(parseISO(log.created_at), 'dd/MM HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{log.user_id ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded mr-1 ${methodColors[method] ?? 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                          {method}
                        </span>
                        <span className="text-gray-600 dark:text-slate-400 font-mono text-xs">{log.action.split(':').slice(1).join(':').replace('/api/v1', '')}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-slate-400">{log.resource_type}{log.resource_id ? `/${log.resource_id}` : ''}</td>
                      <td className="px-3 py-2 text-gray-400 dark:text-slate-500 text-xs font-mono">{log.ip_address ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold ${log.status_code < 300 ? 'text-green-600 dark:text-green-400' : log.status_code < 500 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
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
