import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/orders'
import { ListChecks, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function WorklistPage() {
  const [modality, setModality] = useState('')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['worklist', modality],
    queryFn: () => ordersApi.getWorklist(modality || undefined),
    refetchInterval: 30000, // auto-refresh every 30s
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Worklist DICOM</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data?.length ?? 0} estudios activos · Auto-actualiza cada 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todas</option>
            {['CR', 'CT', 'MR', 'US', 'NM', 'DX', 'MG'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando worklist...</div>
        ) : !data?.length ? (
          <div className="p-12 text-center text-gray-500">
            <ListChecks className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay estudios pendientes en la worklist</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Nº Acceso', 'Paciente', 'ID DICOM', 'Modalidad', 'Procedimiento', 'Programado', 'AE Title'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-primary-600 font-medium">{entry.accession_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{entry.patient_name_dicom}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{entry.patient_id_dicom}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">{entry.modality}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{entry.procedure_description}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {format(parseISO(entry.scheduled_datetime), 'dd/MM HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">
                    {entry.scheduled_station_ae_title || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">Información DICOM MWL</p>
        <p>Los equipos (C-FIND SCU) pueden consultar esta worklist vía DICOM al AE Title configurado en Orthanc.</p>
        <p className="mt-1">Puerto DICOM: <span className="font-mono">4242</span> · AE Title: <span className="font-mono">ORTHANC</span></p>
      </div>
    </div>
  )
}
