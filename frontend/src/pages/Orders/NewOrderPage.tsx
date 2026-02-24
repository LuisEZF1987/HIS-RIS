import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ordersApi } from '@/api/orders'
import { patientsApi } from '@/api/patients'
import { ArrowLeft, Save } from 'lucide-react'

const schema = z.object({
  patient_id: z.number({ coerce: true }).positive('Seleccione un paciente'),
  modality: z.enum(['CR', 'CT', 'MR', 'US', 'NM', 'PT', 'DX', 'MG', 'XA', 'RF', 'OT']),
  procedure_description: z.string().min(3, 'Descripción requerida'),
  procedure_code: z.string().optional(),
  body_part: z.string().optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT', 'ASAP']).default('ROUTINE'),
  clinical_indication: z.string().optional(),
  scheduled_at: z.string().optional(),
})

type FormData = z.infer<typeof schema>
const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"

export default function NewOrderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const prefilledPatientId = searchParams.get('patient_id')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      patient_id: prefilledPatientId ? Number(prefilledPatientId) : undefined,
      priority: 'ROUTINE',
    },
  })

  const patientId = watch('patient_id')

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.get(Number(patientId)),
    enabled: !!patientId && patientId > 0,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => ordersApi.create({
      ...data,
      scheduled_at: data.scheduled_at || undefined,
    }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success(`Orden creada: ${order.accession_number} (MWL generado)`)
      navigate('/orders')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Error al crear orden')
    },
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Orden de Imagen</h1>
          <p className="text-gray-500 text-sm">Se generará automáticamente el registro en la Worklist DICOM</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 border-b pb-2">Paciente</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Paciente *</label>
            <input {...register('patient_id')} type="number" className={inputClass} placeholder="ID del paciente" />
            {errors.patient_id && <p className="text-red-500 text-xs mt-1">{errors.patient_id.message}</p>}
            {patient && (
              <p className="text-green-600 text-xs mt-1">✓ {patient.full_name} (MRN: {patient.mrn})</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 border-b pb-2">Estudio</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad *</label>
              <select {...register('modality')} className={inputClass}>
                <option value="">Seleccionar</option>
                {['CR', 'CT', 'MR', 'US', 'NM', 'DX', 'MG', 'XA', 'RF', 'OT'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {errors.modality && <p className="text-red-500 text-xs mt-1">{errors.modality.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select {...register('priority')} className={inputClass}>
                <option value="ROUTINE">Rutina</option>
                <option value="URGENT">Urgente</option>
                <option value="STAT">STAT</option>
                <option value="ASAP">ASAP</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Procedimiento *</label>
            <input {...register('procedure_description')} className={inputClass} placeholder="Ej: Radiografía de tórax PA y lateral" />
            {errors.procedure_description && <p className="text-red-500 text-xs mt-1">{errors.procedure_description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de Procedimiento</label>
              <input {...register('procedure_code')} className={inputClass} placeholder="71046" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parte del Cuerpo</label>
              <input {...register('body_part')} className={inputClass} placeholder="CHEST" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Indicación Clínica</label>
            <textarea {...register('clinical_indication')} className={inputClass} rows={2} placeholder="Motivo del estudio..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha/Hora Programada</label>
            <input {...register('scheduled_at')} type="datetime-local" className={inputClass} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Creando...' : 'Crear Orden + Worklist'}
          </button>
        </div>
      </form>
    </div>
  )
}
