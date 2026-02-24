import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { scheduleApi } from '@/api/schedule'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { es }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: es }),
  getDay,
  locales,
})

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date())

  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => scheduleApi.listAppointments({}),
  })

  const events = (appointments || []).map((a) => ({
    id: a.id,
    title: `Paciente #${a.patient_id}`,
    start: new Date(a.start_datetime),
    end: new Date(a.end_datetime),
    resource: a,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agenda de Citas</h1>
        <p className="text-gray-500 text-sm mt-1">Gestión de citas y disponibilidad</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4" style={{ height: 600 }}>
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
          }}
        />
      </div>
    </div>
  )
}
