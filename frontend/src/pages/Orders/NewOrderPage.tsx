import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ordersApi } from '@/api/orders'
import { patientsApi } from '@/api/patients'
import { scheduleApi } from '@/api/schedule'
import { ArrowLeft, Save, Search, X } from 'lucide-react'
import { DateTimePicker } from '@/components/DateTimePicker'
import { useState } from 'react'
import type { PatientListItem } from '@/types'
import { toLocalISOString } from '@/utils/datetime'

const schema = z.object({
  patient_id: z.number({ coerce: true }).positive('Seleccione un paciente'),
  modality: z.enum(['CR', 'CT', 'MR', 'US', 'NM', 'PT', 'DX', 'MG', 'XA', 'RF', 'OT']),
  procedure_description: z.string().min(3, 'Descripción requerida'),
  procedure_code: z.string().optional(),
  body_part: z.string().optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT', 'ASAP']).default('ROUTINE'),
  clinical_indication: z.string().optional(),
  scheduled_at: z.string().optional(),
  resource_id: z.number({ coerce: true }).optional(),
  duration_minutes: z.number({ coerce: true }).default(30),
})

type FormData = z.infer<typeof schema>

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg ' +
  'focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ' +
  'placeholder-gray-400 dark:placeholder-slate-500'

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'

const cardClass =
  'bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-4'

export default function NewOrderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const prefilledPatientId = searchParams.get('patient_id')

  const [patientSearch, setPatientSearch] = useState('')
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false)
  const [selectedPatientName, setSelectedPatientName] = useState('')

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      patient_id: prefilledPatientId ? Number(prefilledPatientId) : undefined,
      priority: 'ROUTINE',
    },
  })

  const patientId = watch('patient_id')
  const watchedResourceId = watch('resource_id')
  const watchedScheduledAt = watch('scheduled_at')

  // Search patients for the dropdown
  const { data: patientResults } = useQuery({
    queryKey: ['patients-search-order', patientSearch],
    queryFn: () => patientsApi.list({ q: patientSearch, page: 1, page_size: 6 }),
    enabled: patientSearch.length >= 2,
  })

  // Load prefilled patient name
  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.get(Number(patientId)),
    enabled: !!patientId && patientId > 0 && !selectedPatientName,
  })

  // If prefilled and we got the patient data, set the name
  if (patient && !selectedPatientName && prefilledPatientId) {
    setSelectedPatientName(`${patient.full_name} (MRN: ${patient.mrn})`)
  }

  const selectPatient = (p: PatientListItem) => {
    setValue('patient_id', p.id)
    setSelectedPatientName(`${p.full_name} (MRN: ${p.mrn})`)
    setPatientSearch('')
    setPatientDropdownOpen(false)
  }

  const clearPatient = () => {
    setValue('patient_id', undefined as any)
    setSelectedPatientName('')
    setPatientSearch('')
  }

  const { data: resources } = useQuery({
    queryKey: ['resources', 'available'],
    queryFn: () => scheduleApi.getResources(undefined, true),
  })

  const selectedResource = resources?.find(r => r.id === Number(watchedResourceId))

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      // Validate scheduled date is not in the past
      if (data.scheduled_at) {
        const scheduled = new Date(data.scheduled_at)
        if (scheduled < new Date()) {
          throw { response: { data: { detail: 'No se puede programar una orden en una fecha/hora pasada' } } }
        }
        // Validate operating hours if resource selected
        if (data.resource_id) {
          const res = resources?.find(r => r.id === Number(data.resource_id))
          if (res) {
            const hour = scheduled.getHours()
            if (hour < res.operating_start_hour || hour >= res.operating_end_hour) {
              throw { response: { data: { detail: `La hora programada está fuera del horario de operación de '${res.name}' (${res.operating_start_hour}:00 - ${res.operating_end_hour}:00)` } } }
            }
          }
        }
      }
      return ordersApi.create({
        ...data,
        scheduled_at: data.scheduled_at ? toLocalISOString(data.scheduled_at) : undefined,
        resource_id: data.resource_id || undefined,
        duration_minutes: data.duration_minutes || 30,
      })
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['worklist'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
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
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nueva Orden de Imagen</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">
            Se generará automáticamente el registro en la Worklist DICOM
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">

        {/* Paciente */}
        <div className={cardClass}>
          <h2 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-700 pb-2">
            Paciente
          </h2>

          <div>
            <label className={labelClass}>Paciente *</label>
            <input type="hidden" {...register('patient_id')} />
            {selectedPatientName ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-sm text-green-800 dark:text-green-300">
                  ✓ {selectedPatientName}
                </span>
                <button type="button" onClick={clearPatient} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setPatientDropdownOpen(true) }}
                  onFocus={() => setPatientDropdownOpen(true)}
                  placeholder="Buscar por nombre, MRN o cédula..."
                  className={`${inputClass} pl-9`}
                />
                {patientDropdownOpen && patientResults && patientResults.items.length > 0 && (
                  <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden">
                    {patientResults.items.map((p) => (
                      <li
                        key={p.id}
                        onMouseDown={() => selectPatient(p)}
                        className="px-4 py-2.5 hover:bg-primary-50 dark:hover:bg-slate-700 cursor-pointer text-sm"
                      >
                        <span className="font-medium text-gray-900 dark:text-slate-100">{p.full_name}</span>
                        <span className="text-gray-500 dark:text-slate-400 ml-2 text-xs">MRN: {p.mrn}{p.dni ? ` · CI: ${p.dni}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {patientDropdownOpen && patientSearch.length >= 2 && patientResults?.items.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow p-3 text-sm text-gray-500 dark:text-slate-400">
                    No se encontraron pacientes
                  </div>
                )}
              </div>
            )}
            {errors.patient_id && (
              <p className="text-red-500 text-xs mt-1">{errors.patient_id.message}</p>
            )}
          </div>
        </div>

        {/* Estudio */}
        <div className={cardClass}>
          <h2 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-700 pb-2">
            Estudio
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Modalidad *</label>
              <select {...register('modality')} className={inputClass}>
                <option value="">Seleccionar</option>
                {['CR', 'CT', 'MR', 'US', 'NM', 'DX', 'MG', 'XA', 'RF', 'OT'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {errors.modality && (
                <p className="text-red-500 text-xs mt-1">{errors.modality.message}</p>
              )}
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
            <input
              {...register('procedure_description')}
              className={inputClass}
              placeholder="Ej: Radiografía de tórax PA y lateral"
            />
            {errors.procedure_description && (
              <p className="text-red-500 text-xs mt-1">{errors.procedure_description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Código de Procedimiento</label>
              <input
                {...register('procedure_code')}
                className={inputClass}
                placeholder="71046"
              />
            </div>
            <div>
              <label className={labelClass}>Parte del Cuerpo</label>
              <input
                {...register('body_part')}
                className={inputClass}
                placeholder="CHEST"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Indicación Clínica</label>
            <textarea
              {...register('clinical_indication')}
              className={inputClass}
              rows={2}
              placeholder="Motivo del estudio..."
            />
          </div>

          <div>
            <label className={labelClass}>Fecha/Hora Programada</label>
            <Controller
              name="scheduled_at"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          {watchedScheduledAt && (
            <div>
              <label className={labelClass}>Duración del Estudio</label>
              <select {...register('duration_minutes', { valueAsNumber: true })} className={inputClass}>
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>1 hora</option>
                <option value={90}>1 hora 30 min</option>
                <option value={120}>2 horas</option>
                <option value={180}>3 horas</option>
                <option value={240}>4 horas</option>
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Equipo / Sala (opcional)</label>
            <select {...register('resource_id')} className={inputClass}>
              <option value="">Sin asignar</option>
              {(resources || []).map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.modality || r.resource_type})</option>
              ))}
            </select>
            {selectedResource && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300 mt-1">
                <span className="font-semibold">{selectedResource.name}</span> — Horario: {selectedResource.operating_start_hour}:00 - {selectedResource.operating_end_hour}:00
                {selectedResource.operating_start_hour === 0 && selectedResource.operating_end_hour === 24 && ' (24 horas)'}
              </div>
            )}
            {(!resources || resources.length === 0) && (
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
                No hay equipos registrados. Agregue equipos desde Administración.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-medium text-sm"
          >
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
