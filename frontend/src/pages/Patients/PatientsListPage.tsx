import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { patientsApi } from '@/api/patients'
import { useAuthStore } from '@/store/authStore'
import { Search, Plus, User, ChevronLeft, ChevronRight, Pencil, UserX, X, Save } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import type { PatientListItem } from '@/types'

const genderLabels = { M: 'Masculino', F: 'Femenino', O: 'Otro', U: 'N/E' }

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg ' +
  'focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ' +
  'placeholder-gray-400 dark:placeholder-slate-500'

const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'

interface EditForm {
  first_name: string
  last_name: string
  dni?: string
  gender?: string
  blood_type?: string
  allergies?: string
}

export default function PatientsListPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'receptionist'

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editingPatient, setEditingPatient] = useState<PatientListItem | null>(null)
  const [deactivating, setDeactivating] = useState<PatientListItem | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['patients', debouncedSearch, page],
    queryFn: () => patientsApi.list({ q: debouncedSearch || undefined, page, page_size: 20 }),
  })

  const handleSearch = (value: string) => {
    setSearch(value)
    clearTimeout((window as any)._patientSearchTimer)
    ;(window as any)._patientSearchTimer = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 400)
  }

  const { register, handleSubmit, reset } = useForm<EditForm>()

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditForm }) =>
      patientsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Paciente actualizado')
      setEditingPatient(null)
      reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al actualizar'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => patientsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Paciente desactivado')
      setDeactivating(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al desactivar'),
  })

  const openEdit = async (p: PatientListItem, e: React.MouseEvent) => {
    e.stopPropagation()
    // Fetch full patient to pre-fill form
    const full = await patientsApi.get(p.id)
    setEditingPatient(p)
    reset({
      first_name: full.first_name,
      last_name: full.last_name,
      dni: full.dni ?? '',
      gender: full.gender ?? '',
      blood_type: full.blood_type ?? '',
      allergies: full.allergies ?? '',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pacientes</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            {data?.total ?? 0} pacientes registrados
          </p>
        </div>
        <Link
          to="/patients/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nuevo Paciente
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nombre, MRN o cédula..."
          className={`${inputClass} pl-10`}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">Cargando...</div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">
            <User className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
            <p>No se encontraron pacientes</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
              <tr>
                {['MRN', 'Nombre', 'Fecha Nac.', 'Género', 'Cédula', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {data.items.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td className="px-4 py-3 text-sm font-mono text-primary-600 dark:text-blue-400">{p.mrn}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{p.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {p.date_of_birth ? format(parseISO(p.date_of_birth), 'dd/MM/yyyy', { locale: es }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {p.gender ? genderLabels[p.gender] : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{p.dni || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && (
                        <>
                          <button
                            onClick={(e) => openEdit(p, e)}
                            title="Editar paciente"
                            className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {p.is_active && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeactivating(p) }}
                              title="Desactivar paciente"
                              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      <Link
                        to={`/patients/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        Ver →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Página {data.page} de {data.pages}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-40">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-40">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Patient Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary-600 dark:text-blue-400" />
                Editar Paciente
              </h2>
              <button onClick={() => setEditingPatient(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit((d) => editMutation.mutate({ id: editingPatient.id, data: d }))}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nombre *</label>
                  <input {...register('first_name', { required: true })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Apellido *</label>
                  <input {...register('last_name', { required: true })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Cédula / DNI</label>
                  <input {...register('dni')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Género</label>
                  <select {...register('gender')} className={inputClass}>
                    <option value="">—</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Grupo Sanguíneo</label>
                  <select {...register('blood_type')} className={inputClass}>
                    <option value="">—</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Alergias</label>
                <input {...register('allergies')} className={inputClass} placeholder="Ninguna conocida" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingPatient(null)}
                  className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={editMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {editMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate confirmation */}
      {deactivating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <UserX className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Desactivar Paciente</h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-5">
              ¿Desactivar a <strong>{deactivating.full_name}</strong>? El registro se conserva pero no aparecerá en búsquedas activas.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeactivating(null)}
                className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button
                onClick={() => deactivateMutation.mutate(deactivating.id)}
                disabled={deactivateMutation.isPending}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
              >
                {deactivateMutation.isPending ? 'Desactivando...' : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
