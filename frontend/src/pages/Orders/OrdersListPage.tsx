import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/store/authStore'
import { Plus, ChevronLeft, ChevronRight, Pencil, XCircle, X, Save } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useForm, Controller } from 'react-hook-form'
import { DateTimePicker } from '@/components/DateTimePicker'
import toast from 'react-hot-toast'
import type { ImagingOrder } from '@/types'

const statusColors: Record<string, string> = {
  REQUESTED:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SCHEDULED:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  COMPLETED:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ON_HOLD:     'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

const priorityColors: Record<string, string> = {
  ROUTINE: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  URGENT:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  STAT:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ASAP:    'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
}

const selectClass =
  'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none'

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg ' +
  'focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500'

const labelClass = 'block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1'

interface EditForm {
  modality: string
  procedure_description: string
  procedure_code?: string
  body_part?: string
  priority: string
  clinical_indication?: string
  scheduled_at?: string
}

export default function OrdersListPage() {
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'receptionist'

  const [statusFilter, setStatusFilter] = useState('')
  const [modalityFilter, setModalityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editingOrder, setEditingOrder] = useState<ImagingOrder | null>(null)
  const [cancellingOrder, setCancellingOrder] = useState<ImagingOrder | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter, modalityFilter, page],
    queryFn: () => ordersApi.list({ status: statusFilter || undefined, modality: modalityFilter || undefined, page }),
  })

  const { register, handleSubmit, control, reset } = useForm<EditForm>()

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditForm }) =>
      ordersApi.edit(id, {
        ...data,
        scheduled_at: data.scheduled_at || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Orden actualizada')
      setEditingOrder(null)
      reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al actualizar'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => ordersApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Orden cancelada')
      setCancellingOrder(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al cancelar'),
  })

  const openEdit = (o: ImagingOrder, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingOrder(o)
    reset({
      modality: o.modality,
      procedure_description: o.procedure_description,
      procedure_code: o.procedure_code ?? '',
      body_part: o.body_part ?? '',
      priority: o.priority,
      clinical_indication: o.clinical_indication ?? '',
      scheduled_at: o.scheduled_at ? o.scheduled_at.slice(0, 16) : '',
    })
  }

  const isEditable = (o: ImagingOrder) =>
    o.status !== 'COMPLETED' && o.status !== 'CANCELLED'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Imagen</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{data?.total ?? 0} órdenes</p>
        </div>
        <Link to="/orders/new" className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus className="w-4 h-4" />
          Nueva Orden
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className={selectClass}>
          <option value="">Todos los estados</option>
          {['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={modalityFilter} onChange={(e) => { setModalityFilter(e.target.value); setPage(1) }} className={selectClass}>
          <option value="">Todas las modalidades</option>
          {['CR', 'CT', 'MR', 'US', 'NM', 'DX', 'MG'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">Cargando...</div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">No se encontraron órdenes</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
              <tr>
                {['Acceso', 'Modalidad', 'Procedimiento', 'Prioridad', 'Estado', 'Fecha', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {data.items.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 text-sm font-mono text-primary-600 dark:text-blue-400">{o.accession_number}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded">{o.modality}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-slate-100 max-w-[200px] truncate">{o.procedure_description}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColors[o.priority]}`}>{o.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[o.status]}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {format(parseISO(o.requested_at), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && isEditable(o) && (
                        <>
                          <button
                            onClick={(e) => openEdit(o, e)}
                            title="Editar orden"
                            className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCancellingOrder(o) }}
                            title="Cancelar orden"
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <Link to={`/patients/${o.patient_id}`} className="text-primary-600 dark:text-blue-400 hover:underline text-sm">
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
            <p className="text-sm text-gray-500 dark:text-slate-400">Página {data.page} de {data.pages}</p>
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

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary-600 dark:text-blue-400" />
                Editar Orden — <span className="font-mono text-sm text-primary-600 dark:text-blue-400">{editingOrder.accession_number}</span>
              </h2>
              <button onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit((d) => editMutation.mutate({ id: editingOrder.id, data: d }))}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Modalidad</label>
                  <select {...register('modality')} className={inputClass}>
                    {['CR','CT','MR','US','NM','DX','MG','XA','RF','OT'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Prioridad</label>
                  <select {...register('priority')} className={inputClass}>
                    <option value="ROUTINE">Rutina</option>
                    <option value="URGENT">Urgente</option>
                    <option value="STAT">STAT</option>
                    <option value="ASAP">ASAP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Descripción del Procedimiento *</label>
                <input {...register('procedure_description', { required: true })} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Código Procedimiento</label>
                  <input {...register('procedure_code')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Parte del Cuerpo</label>
                  <input {...register('body_part')} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Indicación Clínica</label>
                <textarea {...register('clinical_indication')} className={inputClass} rows={2} />
              </div>

              <div>
                <label className={labelClass}>Fecha/Hora Programada</label>
                <Controller
                  name="scheduled_at"
                  control={control}
                  render={({ field }) => (
                    <DateTimePicker value={field.value} onChange={field.onChange} />
                  )}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingOrder(null)}
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

      {/* Cancel Order confirmation */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cancelar Orden</h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-1">
              ¿Cancelar la orden <strong className="font-mono">{cancellingOrder.accession_number}</strong>?
            </p>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-5">{cancellingOrder.procedure_description}</p>
            <div className="flex gap-3">
              <button onClick={() => setCancellingOrder(null)}
                className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
                No cancelar
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancellingOrder.id)}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
