import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { scheduleApi } from '@/api/schedule'
import { patientsApi } from '@/api/patients'
import { useForm, Controller } from 'react-hook-form'
import { DateTimePicker } from '@/components/DateTimePicker'
import toast from 'react-hot-toast'
import { Plus, X, CalendarPlus, Search } from 'lucide-react'
import type { PatientListItem } from '@/types'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { es }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: es }),
  getDay,
  locales,
})

interface AppointmentForm {
  patient_id: number
  order_id?: number
  resource_id?: number
  start_datetime: string
  duration_minutes: number
  notes?: string
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg ' +
  'focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ' +
  'placeholder-gray-400 dark:placeholder-slate-500'

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'

// ── Patient search widget ────────────────────────────────────────────────────
function PatientSearchField({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (id: number, name: string) => void
}) {
  const [searchText, setSearchText] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [open, setOpen] = useState(false)

  const { data: results } = useQuery({
    queryKey: ['patients-search', searchText],
    queryFn: () => patientsApi.list({ q: searchText, page: 1, page_size: 6 }),
    enabled: searchText.length >= 2,
  })

  const selectPatient = (p: PatientListItem) => {
    onChange(p.id, p.full_name)
    setSelectedName(`${p.full_name} (MRN: ${p.mrn})`)
    setSearchText('')
    setOpen(false)
  }

  if (value && selectedName) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg text-sm text-green-800 dark:text-green-300">
          ✓ {selectedName}
        </span>
        <button
          type="button"
          onClick={() => { setSelectedName(''); onChange(0, '') }}
          className="text-gray-400 hover:text-red-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por nombre, MRN o cédula..."
          className={`${inputClass} pl-9`}
        />
      </div>
      {open && results && results.items.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden">
          {results.items.map((p) => (
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
      {open && searchText.length >= 2 && results?.items.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow p-3 text-sm text-gray-500 dark:text-slate-400">
          No se encontraron pacientes
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<number>(0)
  const queryClient = useQueryClient()

  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => scheduleApi.listAppointments({}),
  })

  const { data: resources } = useQuery({
    queryKey: ['resources'],
    queryFn: () => scheduleApi.getResources(),
  })

  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<AppointmentForm>({
    defaultValues: { duration_minutes: 30 },
  })

  const handlePatientSelect = useCallback((id: number, _name: string) => {
    setSelectedPatientId(id)
    setValue('patient_id', id)
  }, [setValue])

  const mutation = useMutation({
    mutationFn: (data: AppointmentForm) =>
      scheduleApi.createAppointment({
        ...data,
        patient_id: Number(data.patient_id),
        order_id: data.order_id ? Number(data.order_id) : undefined,
        resource_id: data.resource_id ? Number(data.resource_id) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Cita creada exitosamente')
      setShowModal(false)
      setSelectedPatientId(0)
      reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Error al crear la cita')
    },
  })

  // Build enriched calendar events
  const events = (appointments || []).map((a) => {
    const title = [
      a.patient_name ?? `Paciente #${a.patient_id}`,
      a.procedure_description ?? a.notes,
    ].filter(Boolean).join(' — ')

    return {
      id: a.id,
      title,
      start: new Date(a.start_datetime),
      end: new Date(a.end_datetime),
      resource: a,
    }
  })

  const closeModal = () => {
    setShowModal(false)
    setSelectedPatientId(0)
    reset()
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agenda de Citas</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            {appointments?.length ?? 0} citas programadas
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva Cita
        </button>
      </div>

      {/* Calendar */}
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4"
        style={{ height: 620 }}
      >
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={setCurrentDate}
          culture="es"
          messages={{
            next: 'Siguiente',
            previous: 'Anterior',
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            agenda: 'Agenda',
            noEventsInRange: 'No hay citas en este período',
          }}
        />
      </div>

      {/* Info note */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
        <p className="font-semibold mb-1">Nota</p>
        <p>Las <strong>órdenes con fecha programada</strong> crean cita automáticamente. También puede crearlas manualmente aquí.</p>
      </div>

      {/* Create Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <CalendarPlus className="w-5 h-5 text-primary-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Cita</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Asignar fecha, hora y sala</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">

              {/* Patient search */}
              <div>
                <label className={labelClass}>Paciente *</label>
                <input type="hidden" {...register('patient_id', { required: true, min: 1 })} />
                <PatientSearchField
                  value={selectedPatientId || undefined}
                  onChange={handlePatientSelect}
                />
                {errors.patient_id && (
                  <p className="text-red-500 text-xs mt-1">Seleccione un paciente</p>
                )}
              </div>

              {/* Order ID (optional) */}
              <div>
                <label className={labelClass}>ID Orden (opcional)</label>
                <input
                  {...register('order_id', { valueAsNumber: true })}
                  type="number"
                  className={inputClass}
                  placeholder="Vincular a una orden existente"
                />
              </div>

              {/* Resource */}
              {resources && resources.length > 0 && (
                <div>
                  <label className={labelClass}>Sala / Equipo (opcional)</label>
                  <select {...register('resource_id', { valueAsNumber: true })} className={inputClass}>
                    <option value="">Sin asignar</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.modality || r.resource_type})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date/Time */}
              <div>
                <label className={labelClass}>Fecha y Hora *</label>
                <Controller
                  name="start_datetime"
                  control={control}
                  rules={{ required: 'Requerida' }}
                  render={({ field }) => (
                    <DateTimePicker value={field.value} onChange={field.onChange} />
                  )}
                />
                {errors.start_datetime && (
                  <p className="text-red-500 text-xs mt-1">{errors.start_datetime.message}</p>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className={labelClass}>Duración</label>
                <select {...register('duration_minutes', { valueAsNumber: true })} className={inputClass}>
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1 hora 30 min</option>
                  <option value={120}>2 horas</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>Notas</label>
                <textarea {...register('notes')} className={inputClass} rows={2} placeholder="Observaciones..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending || !selectedPatientId}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm"
                >
                  {mutation.isPending ? 'Guardando...' : 'Crear Cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
