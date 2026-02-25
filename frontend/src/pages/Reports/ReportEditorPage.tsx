import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { reportsApi } from '@/api/reports'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Save, FileSignature, Download, X, ShieldCheck, Lock } from 'lucide-react'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const textareaClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg ' +
  'focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm resize-none ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ' +
  'placeholder-gray-400 dark:placeholder-slate-500 ' +
  'disabled:bg-gray-50 dark:disabled:bg-slate-900/50 disabled:cursor-not-allowed'

const labelClass = 'block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1'

export default function ReportEditorPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [signPassword, setSignPassword] = useState('')
  const [showSignModal, setShowSignModal] = useState(false)

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsApi.get(Number(id)),
    enabled: !!id,
  })

  const { register, handleSubmit } = useForm({
    values: report ? {
      findings: report.findings || '',
      impression: report.impression || '',
      recommendation: report.recommendation || '',
      technique: report.technique || '',
    } : undefined,
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => reportsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      toast.success('Informe guardado')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al guardar'),
  })

  const signMutation = useMutation({
    mutationFn: () => reportsApi.sign(Number(id), signPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      toast.success('Informe firmado digitalmente')
      setShowSignModal(false)
      setSignPassword('')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Error al firmar'
      toast.error(msg)
    },
  })

  const downloadPdf = async () => {
    try {
      const blob = await reportsApi.downloadPdf(Number(id))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `informe_${id}.pdf`
      a.click()
    } catch {
      toast.error('Error al generar PDF')
    }
  }

  const isSigned = report?.status === 'final'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-slate-400">Cargando informe...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Editor de Informe</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            Estado:{' '}
            <span className={`font-semibold ${isSigned ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
              {report?.status?.toUpperCase() ?? '—'}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          {isSigned && (
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
          )}
          {!isSigned && (
            <button
              onClick={() => setShowSignModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              <FileSignature className="w-4 h-4" />
              Firmar Informe
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-5">

          <div>
            <label className={labelClass}>Técnica</label>
            <textarea
              {...register('technique')}
              rows={2}
              className={textareaClass}
              disabled={isSigned}
              placeholder="Descripción de la técnica utilizada..."
            />
          </div>

          <div>
            <label className={labelClass}>Hallazgos</label>
            <textarea
              {...register('findings')}
              rows={6}
              className={textareaClass}
              disabled={isSigned}
              placeholder="Hallazgos del estudio..."
            />
          </div>

          <div>
            <label className={labelClass}>Impresión Diagnóstica *</label>
            <textarea
              {...register('impression')}
              rows={4}
              className={textareaClass}
              disabled={isSigned}
              placeholder="Impresión diagnóstica..."
            />
          </div>

          <div>
            <label className={labelClass}>Recomendaciones</label>
            <textarea
              {...register('recommendation')}
              rows={2}
              className={textareaClass}
              disabled={isSigned}
              placeholder="Recomendaciones adicionales..."
            />
          </div>
        </div>

        {!isSigned && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Borrador'}
            </button>
          </div>
        )}
      </form>

      {/* Signed badge */}
      {isSigned && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
            <p className="font-semibold text-green-800 dark:text-green-300">Informe Firmado Digitalmente</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-green-600 dark:text-green-400 text-xs font-medium uppercase tracking-wide">Firmado por</p>
              <p className="text-green-900 dark:text-green-200 font-medium">{report?.signed_by ?? '—'}</p>
            </div>
            <div>
              <p className="text-green-600 dark:text-green-400 text-xs font-medium uppercase tracking-wide">Fecha</p>
              <p className="text-green-900 dark:text-green-200">
                {report?.signed_at
                  ? format(parseISO(report.signed_at), "dd/MM/yyyy HH:mm", { locale: es })
                  : '—'}
              </p>
            </div>
          </div>
          {report?.signature_hash && (
            <p className="font-mono text-xs text-green-700 dark:text-green-400 mt-3 break-all">
              Hash: {report.signature_hash.substring(0, 48)}...
            </p>
          )}
        </div>
      )}

      {/* ── Sign Modal ──────────────────────────────────────────────────────── */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <FileSignature className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Firmar Informe</h2>
              </div>
              <button
                onClick={() => { setShowSignModal(false); setSignPassword('') }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">

              {/* User info box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                  Firmando como
                </p>
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                  {user?.full_name ?? user?.username ?? 'Usuario actual'}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  @{user?.username}
                </p>
              </div>

              {/* Instruction */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Contraseña de inicio de sesión
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                  Ingrese la misma contraseña que usa para iniciar sesión en el sistema. Esto vincula su identidad digital al informe.
                </p>
                <input
                  type="password"
                  value={signPassword}
                  onChange={(e) => setSignPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && signPassword && signMutation.mutate()}
                  placeholder="••••••••"
                  autoFocus
                  className={
                    'w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg ' +
                    'focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm ' +
                    'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 ' +
                    'placeholder-gray-400 dark:placeholder-slate-500'
                  }
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setShowSignModal(false); setSignPassword('') }}
                className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 py-2.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => signMutation.mutate()}
                disabled={!signPassword || signMutation.isPending}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                {signMutation.isPending ? 'Firmando...' : 'Firmar Digitalmente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
