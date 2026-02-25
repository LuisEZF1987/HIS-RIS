import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '@/api/orders'
import { apiClient } from '@/api/client'
import { ListChecks, RefreshCw, FlaskConical } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

function generateStudyUID(accession: string): string {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 9999)
  return `2.25.${ts}${rand}`
}

export default function WorklistPage() {
  const [modality, setModality] = useState('')
  const [simulating, setSimulating] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['worklist', modality],
    queryFn: () => ordersApi.getWorklist(modality || undefined),
    refetchInterval: 30000,
  })

  const handleSimulate = async (entryId: number, accession: string) => {
    setSimulating(entryId)
    const studyUID = generateStudyUID(accession)
    try {
      await apiClient.post('/orthanc/webhook', {
        ChangeType: 'StableStudy',
        ResourceType: 'Study',
        ID: `sim-${accession}-${Date.now()}`,
        source: 'simulation',
        MainDicomTags: {
          StudyInstanceUID: studyUID,
          AccessionNumber: accession,
          StudyDescription: 'Estudio simulado',
          StudyDate: format(new Date(), 'yyyyMMdd'),
          Modality: modality || 'CR',
        },
      })
      toast.success(`Estudio simulado vinculado a orden ${accession}`)
      queryClient.invalidateQueries({ queryKey: ['worklist'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error al simular llegada del estudio')
    } finally {
      setSimulating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Worklist DICOM</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            {data?.length ?? 0} estudios activos · Auto-actualiza cada 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todas</option>
            {['CR', 'CT', 'MR', 'US', 'NM', 'DX', 'MG'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400">Cargando worklist...</div>
        ) : !data?.length ? (
          <div className="p-12 text-center text-gray-500 dark:text-slate-400">
            <ListChecks className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
            <p>No hay estudios pendientes en la worklist</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
              <tr>
                {['Nº Acceso', 'Paciente', 'ID DICOM', 'Modalidad', 'Procedimiento', 'Programado', 'AE Title', 'Acción'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {data.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 text-sm font-mono text-primary-600 dark:text-blue-400 font-medium">{entry.accession_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-slate-100">{entry.patient_name_dicom}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-slate-400">{entry.patient_id_dicom}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded">
                      {entry.modality}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{entry.procedure_description}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {format(parseISO(entry.scheduled_datetime), 'dd/MM HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-slate-400">
                    {entry.scheduled_station_ae_title || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSimulate(entry.id, entry.accession_number)}
                      disabled={simulating === entry.id}
                      title="Simular llegada de estudio DICOM"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors"
                    >
                      <FlaskConical className={`w-3.5 h-3.5 ${simulating === entry.id ? 'animate-pulse' : ''}`} />
                      {simulating === entry.id ? 'Simulando...' : 'Simular'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* DICOM info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
        <p className="font-semibold mb-1">Información DICOM MWL</p>
        <p>Los equipos (C-FIND SCU) pueden consultar esta worklist vía DICOM al AE Title configurado en Orthanc.</p>
        <p className="mt-1">Puerto DICOM: <span className="font-mono">4242</span> · AE Title: <span className="font-mono">ORTHANC</span></p>
      </div>

      {/* Simulation info */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-700">
        <p className="font-semibold mb-1">Simulación de Estudio</p>
        <p>
          El botón <strong>Simular</strong> envía un webhook al sistema como si el equipo de imagen hubiera
          enviado el estudio vía DICOM C-STORE. Útil para pruebas sin equipo físico conectado.
          La orden pasará a estado <strong>COMPLETED</strong>.
        </p>
      </div>
    </div>
  )
}
