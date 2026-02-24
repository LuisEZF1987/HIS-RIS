import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { reportsApi } from '@/api/reports'
import toast from 'react-hot-toast'
import { Save, FileSignature, Download } from 'lucide-react'
import { useState } from 'react'

export default function ReportEditorPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [signPassword, setSignPassword] = useState('')
  const [showSignModal, setShowSignModal] = useState(false)

  const { data: report } = useQuery({
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
      toast.success('Informe actualizado')
    },
  })

  const signMutation = useMutation({
    mutationFn: () => reportsApi.sign(Number(id), signPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      toast.success('Informe firmado digitalmente')
      setShowSignModal(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Error al firmar'),
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
  const textareaClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm resize-none"

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editor de Informe</h1>
          <p className="text-gray-500 text-sm">
            Estado: <span className={`font-medium ${isSigned ? 'text-green-600' : 'text-yellow-600'}`}>
              {report?.status?.toUpperCase()}
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          {isSigned && (
            <button onClick={downloadPdf} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
          )}
          {!isSigned && (
            <button
              onClick={() => setShowSignModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              <FileSignature className="w-4 h-4" />
              Firmar Informe
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Técnica</label>
            <textarea {...register('technique')} rows={2} className={textareaClass} disabled={isSigned} placeholder="Descripción de la técnica utilizada..." />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Hallazgos</label>
            <textarea {...register('findings')} rows={6} className={textareaClass} disabled={isSigned} placeholder="Hallazgos del estudio..." />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Impresión Diagnóstica *</label>
            <textarea {...register('impression')} rows={4} className={textareaClass} disabled={isSigned} placeholder="Impresión diagnóstica..." />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Recomendaciones</label>
            <textarea {...register('recommendation')} rows={2} className={textareaClass} disabled={isSigned} placeholder="Recomendaciones..." />
          </div>
        </div>

        {!isSigned && (
          <div className="flex justify-end">
            <button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Borrador'}
            </button>
          </div>
        )}

        {isSigned && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
            <p className="font-semibold">Informe Firmado Digitalmente</p>
            <p>Firmado por: {report?.signed_by}</p>
            <p>Fecha: {report?.signed_at}</p>
            <p className="font-mono text-xs mt-1">Hash: {report?.signature_hash?.substring(0, 32)}...</p>
          </div>
        )}
      </form>

      {/* Sign modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Firmar Informe</h2>
            <p className="text-sm text-gray-500 mb-4">Ingrese su contraseña para firmar digitalmente el informe.</p>
            <input
              type="password"
              value={signPassword}
              onChange={(e) => setSignPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSignModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={() => signMutation.mutate()}
                disabled={!signPassword || signMutation.isPending}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {signMutation.isPending ? 'Firmando...' : 'Confirmar Firma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
