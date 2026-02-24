import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordersApi } from '@/api/orders'
import { FileText } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function ReportsListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'completed'],
    queryFn: () => ordersApi.list({ status: 'COMPLETED', page: 1, page_size: 50 }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Informes Radiológicos</h1>
        <p className="text-gray-500 text-sm mt-1">Estudios completados pendientes de informe</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : !data?.items.length ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay estudios completados disponibles</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Nº Acceso', 'Modalidad', 'Procedimiento', 'Fecha', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.items.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-primary-600">{order.accession_number}</td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded">{order.modality}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{order.procedure_description}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {order.completed_at ? format(parseISO(order.completed_at), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-primary-600 text-sm hover:underline cursor-pointer">Crear Informe →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
