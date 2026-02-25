import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { reportsApi } from '@/api/reports'
import { FileText, FilePlus, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import type { ReportStatus } from '@/types'

const STATUS_LABELS: Record<ReportStatus | string, { label: string; color: string }> = {
  draft:       { label: 'Borrador',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  preliminary: { label: 'Preliminar', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  final:       { label: 'Firmado',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  amended:     { label: 'Enmendado',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  cancelled:   { label: 'Cancelado',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const tableCardClass =
  'bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden'
const theadClass =
  'bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700'
const thClass =
  'text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide px-4 py-3'
const tbodyClass =
  'divide-y divide-gray-50 dark:divide-slate-700'
const trHover =
  'hover:bg-gray-50 dark:hover:bg-slate-700/50'

export default function ReportsListPage() {
  const [tab, setTab] = useState<'pending' | 'reports'>('pending')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: studies, isLoading: loadingStudies } = useQuery({
    queryKey: ['studies'],
    queryFn: () => reportsApi.listStudies(),
    enabled: tab === 'pending',
  })

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.list(),
    enabled: tab === 'reports',
  })

  const createReport = useMutation({
    mutationFn: (study_id: number) => reportsApi.create({ study_id }),
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['studies'] })
      toast.success('Informe creado — redactando...')
      navigate(`/reports/${report.id}`)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al crear informe'),
  })

  const pendingStudies = studies?.filter((s) => !s.report_id) ?? []
  const studiesWithReport = studies?.filter((s) => !!s.report_id) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Informes Radiológicos</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Gestión de informes y estudios pendientes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'pending'
              ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pendientes de Informe
          </span>
        </button>
        <button
          onClick={() => setTab('reports')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'reports'
              ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Mis Informes
          </span>
        </button>
      </div>

      {/* ── Tab: Estudios pendientes ── */}
      {tab === 'pending' && (
        <div className={tableCardClass}>
          {loadingStudies ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">Cargando estudios...</div>
          ) : pendingStudies.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p className="font-medium">No hay estudios pendientes de informe</p>
              {studiesWithReport.length > 0 && (
                <p className="text-sm mt-1">
                  {studiesWithReport.length} estudio(s) ya tienen informe →{' '}
                  <button onClick={() => setTab('reports')} className="text-primary-600 dark:text-blue-400 underline">ver informes</button>
                </p>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className={theadClass}>
                <tr>
                  {['Paciente', 'MRN', 'Nº Acceso', 'Modalidad', 'Series', 'Recibido', 'Acción'].map((h) => (
                    <th key={h} className={thClass}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {pendingStudies.map((s) => (
                  <tr key={s.id} className={trHover}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{s.patient_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-slate-400">{s.patient_mrn ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-primary-600 dark:text-blue-400">{s.accession_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded">
                        {s.modality ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{s.series_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                      {s.received_at ? format(parseISO(s.received_at), 'dd/MM/yy HH:mm') : format(parseISO(s.created_at), 'dd/MM/yy')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => createReport.mutate(s.id)}
                        disabled={createReport.isPending}
                        className="flex items-center gap-1.5 bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        <FilePlus className="w-3.5 h-3.5" />
                        Crear Informe
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Informes existentes ── */}
      {tab === 'reports' && (
        <div className={tableCardClass}>
          {loadingReports ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">Cargando informes...</div>
          ) : !reports?.length ? (
            <div className="p-12 text-center text-gray-500 dark:text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
              <p>No hay informes creados aún</p>
              <button onClick={() => setTab('pending')} className="mt-2 text-primary-600 dark:text-blue-400 text-sm underline">
                Ver estudios pendientes →
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className={theadClass}>
                <tr>
                  {['Paciente', 'MRN', 'Nº Acceso', 'Modalidad', 'Estado', 'Actualizado', 'Acciones'].map((h) => (
                    <th key={h} className={thClass}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={tbodyClass}>
                {reports.map((rp) => {
                  const s = STATUS_LABELS[rp.status] ?? { label: rp.status, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={rp.id} className={trHover}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{rp.patient_name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-slate-400">{rp.patient_mrn ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-primary-600 dark:text-blue-400">{rp.accession_number ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded">
                          {rp.modality ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.color}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                        {format(parseISO(rp.updated_at), 'dd/MM/yy HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/reports/${rp.id}`}
                          className="text-primary-600 dark:text-blue-400 text-sm font-medium hover:underline"
                        >
                          {rp.status === 'final' ? 'Ver →' : 'Editar →'}
                        </Link>
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
