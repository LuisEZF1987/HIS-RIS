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
import { Plus, X, CalendarPlus, Search, User, Clock, FileText, ExternalLink, Calendar as CalendarIcon } from 'lucide-react'
import type { PatientListItem, Appointment, Resource } from '@/types'
import { toLocalISOString } from '@/utils/datetime'
import { Link } from 'react-router-dom'
import { format as fmtDate, parseISO } from 'date-fns'
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
  modality?: string
  procedure_description?: string
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg ' +
  'focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm ' +
  'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 ' +
  'placeholder-gray-400 dark:placeholder-slate-500'

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'

const statusLabels: Record<string, string> = {
  proposed: 'Propuesta',
  pending: 'Pendiente',
  booked: 'Confirmada',
  arrived: 'Llegó',
  fulfilled: 'Completada',
  cancelled: 'Cancelada',
  noshow: 'No asistió',
}

const statusColors: Record<string, string> = {
  proposed: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  booked: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  arrived: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  fulfilled: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  noshow: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

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

// ── Appointment detail modal ─────────────────────────────────────────────────
function AppointmentDetailModal({
  appointment,
  onClose,
}: {
  appointment: Appointment
  onClose: () => void
}) {
  const formatDT = (dt: string) => {
    try {
      return fmtDate(parseISO(dt), "EEEE dd 'de' MMMM yyyy, HH:mm", { locale: es })
    } catch {
      return dt
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Detalles de la Cita</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[appointment.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {statusLabels[appointment.status] ?? appointment.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Patient */}
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Paciente</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                {appointment.patient_name ?? `Paciente #${appointment.patient_id}`}
              </p>
            </div>
            <Link
              to={`/patients/${appointment.patient_id}`}
              onClick={onClose}
              className="shrink-0 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Ver ficha
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Procedure */}
          {appointment.procedure_description && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Estudio / Procedimiento</p>
                <p className="text-sm text-gray-900 dark:text-slate-100">{appointment.procedure_description}</p>
              </div>
            </div>
          )}

          {/* Date / Time */}
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Fecha y Hora</p>
              <p className="text-sm text-gray-900 dark:text-slate-100 capitalize">
                {formatDT(appointment.start_datetime)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Duración: {appointment.duration_minutes} min
              </p>
            </div>
          </div>

          {/* Resource */}
          {appointment.resource_name && (
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-gray-500 dark:text-slate-400">Equipo / Sala: </span>
              <span className="font-semibold text-gray-900 dark:text-slate-100">{appointment.resource_name}</span>
            </div>
          )}

          {/* Order ID */}
          {appointment.order_id && (
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-gray-500 dark:text-slate-400">Orden vinculada: </span>
              <span className="font-mono font-semibold text-gray-900 dark:text-slate-100">#{appointment.order_id}</span>
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg px-4 py-2.5">
              <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide mb-1">Notas</p>
              <p className="text-sm text-yellow-900 dark:text-yellow-200">{appointment.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Link
            to={`/patients/${appointment.patient_id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <User className="w-4 h-4" />
            Ver Ficha del Paciente
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<number>(0)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [resourceFilter, setResourceFilter] = useState<string>('')
  const queryClient = useQueryClient()

  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => scheduleApi.listAppointments({}),
  })

  const { data: resources } = useQuery({
    queryKey: ['resources'],
    queryFn: () => scheduleApi.getResources(),
  })

  const { data: availableResources } = useQuery({
    queryKey: ['resources', 'available'],
    queryFn: () => scheduleApi.getResources(undefined, true),
  })

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors } } = useForm<AppointmentForm>({
    defaultValues: { duration_minutes: 30 },
  })

  const watchedResourceId = watch('resource_id')
  const watchedOrderId = watch('order_id')
  const selectedResource = availableResources?.find(r => r.id === Number(watchedResourceId))

  const handlePatientSelect = useCallback((id: number, _name: string) => {
    setSelectedPatientId(id)
    setValue('patient_id', id)
  }, [setValue])

  const mutation = useMutation({
    mutationFn: (data: AppointmentForm) => {
      // Require modality + procedure_description when no order is linked
      if (!data.order_id && (!data.modality || !data.procedure_description)) {
        throw { response: { data: { detail: 'Debe indicar modalidad y procedimiento, o vincular una orden existente' } } }
      }
      // Client-side validation: no past dates
      const startDt = new Date(data.start_datetime)
      if (startDt < new Date()) {
        throw { response: { data: { detail: 'No se puede agendar una cita en una fecha/hora pasada' } } }
      }
      // Client-side validation: operating hours
      if (data.resource_id) {
        const res = resources?.find(r => r.id === Number(data.resource_id))
        if (res) {
          const hour = startDt.getHours()
          const endHour = hour + Math.ceil(data.duration_minutes / 60)
          if (hour < res.operating_start_hour || endHour > res.operating_end_hour) {
            throw { response: { data: { detail: `La cita está fuera del horario de operación de '${res.name}' (${res.operating_start_hour}:00 - ${res.operating_end_hour}:00)` } } }
          }
        }
      }
      return scheduleApi.createAppointment({
        ...data,
        patient_id: Number(data.patient_id),
        order_id: data.order_id ? Number(data.order_id) : undefined,
        resource_id: data.resource_id ? Number(data.resource_id) : undefined,
        start_datetime: toLocalISOString(data.start_datetime),
        modality: data.modality || undefined,
        procedure_description: data.procedure_description || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['worklist'] })
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
  const filteredAppointments = (appointments || []).filter((a) => {
    if (!resourceFilter) return true
    return String(a.resource_id) === resourceFilter
  })

  const events = filteredAppointments.map((a) => {
    const parts = [
      a.patient_name ?? `Paciente #${a.patient_id}`,
      a.procedure_description ?? a.notes,
    ].filter(Boolean)
    if (a.resource_name) parts.push(`[${a.resource_name}]`)
    const title = parts.join(' — ')

    return {
      id: a.id,
      title,
      start: new Date(a.start_datetime),
      end: new Date(a.end_datetime),
      resource: a,
    }
  })

  const handleSelectEvent = useCallback((event: any) => {
    setSelectedAppointment(event.resource as Appointment)
  }, [])

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
            {filteredAppointments.length} citas{resourceFilter ? ' (filtradas)' : ''} programadas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {resources && resources.length > 0 && (
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">Todos los equipos</option>
              {resources.map((r) => (
                <option key={r.id} value={String(r.id)}>{r.name} ({r.modality || r.resource_type})</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nueva Cita
          </button>
        </div>
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
          onSelectEvent={handleSelectEvent}
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
        <p>Las <strong>órdenes con fecha programada</strong> crean cita automáticamente. También puede crearlas manualmente aquí. Haga <strong>clic en una cita</strong> para ver los detalles.</p>
      </div>

      {/* Appointment detail modal */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      )}

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

              {/* Study info — shown when no order_id to auto-create order + worklist */}
              {!watchedOrderId && (
                <div className="space-y-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg p-3 border border-gray-200 dark:border-slate-600">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    Datos del Estudio (se creará orden + worklist automáticamente)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Modalidad *</label>
                      <select {...register('modality')} className={inputClass}>
                        <option value="">Seleccionar</option>
                        {['CR', 'CT', 'MR', 'US', 'NM', 'DX', 'MG', 'XA', 'RF', 'OT'].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Procedimiento *</label>
                      <input
                        {...register('procedure_description')}
                        className={inputClass}
                        placeholder="Ej: Rx Tórax PA"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Resource */}
              <div>
                <label className={labelClass}>Sala / Equipo (opcional)</label>
                <select {...register('resource_id', { valueAsNumber: true })} className={inputClass}>
                  <option value="">Sin asignar</option>
                  {(availableResources || []).map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.modality || r.resource_type})</option>
                  ))}
                </select>
                {(!availableResources || availableResources.length === 0) && (
                  <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
                    No hay equipos disponibles. Agregue o habilite equipos desde Administración.
                  </p>
                )}
              </div>

              {/* Operating hours info */}
              {selectedResource && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">{selectedResource.name}</span> — Horario de operación: {selectedResource.operating_start_hour}:00 - {selectedResource.operating_end_hour}:00
                  {selectedResource.operating_start_hour === 0 && selectedResource.operating_end_hour === 24 && ' (24 horas)'}
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
                  <option value={180}>3 horas</option>
                  <option value={240}>4 horas</option>
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
