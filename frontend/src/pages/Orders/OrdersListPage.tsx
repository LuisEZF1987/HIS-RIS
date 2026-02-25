import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordersApi } from '@/api/orders'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const statusColors: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SCHEDULED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ON_HOLD: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

const priorityColors: Record<string, string> = {
  ROUTINE: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  URGENT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  STAT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ASAP: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
}

const selectClass =
  'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ' +
  'focus:ring-2 focus:ring-primary-500 outline-none'

export default function OrdersListPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [modalityFilter, setModalityFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter, modalityFilter, page],
    queryFn: () => ordersApi.list({
      status: statusFilter || undefined,
      modality: modalityFilter || undefined,
      page,
    }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Imagen</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{data?.total ?? 0} órdenes</p>
        </div>
        <Link
          to="/orders/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva Orden
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className={selectClass}
        >
          <option value="">Todos los estados</option>
          {['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={modalityFilter}
          onChange={(e) => { setModalityFilter(e.target.value); setPage(1) }}
          className={selectClass}
        >
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
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-slate-100">{o.procedure_description}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColors[o.priority]}`}>{o.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[o.status]}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {format(parseISO(o.requested_at), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/patients/${o.patient_id}`} className="text-primary-600 dark:text-blue-400 hover:underline text-sm">
                      Ver →
                    </Link>
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
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
