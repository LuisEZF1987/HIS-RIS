import { useQuery } from '@tanstack/react-query'
import { patientsApi } from '@/api/patients'
import { Link } from 'react-router-dom'
import { ClipboardList, FileText, Monitor } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const typeConfig = {
  order: { icon: ClipboardList, color: 'bg-blue-500', dotColor: 'bg-blue-100 dark:bg-blue-900/30' },
  study: { icon: Monitor, color: 'bg-green-500', dotColor: 'bg-green-100 dark:bg-green-900/30' },
  report: { icon: FileText, color: 'bg-purple-500', dotColor: 'bg-purple-100 dark:bg-purple-900/30' },
}

export default function PatientTimeline({ patientId }: { patientId: number }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: () => patientsApi.timeline(patientId),
  })

  if (isLoading) return <div className="text-center py-8 text-gray-500 dark:text-slate-400">Cargando historial...</div>
  if (!events?.length) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-slate-400">
        <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
        <p className="text-sm">No hay eventos en el historial</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-700" />

      <div className="space-y-4">
        {events.map((event, i) => {
          const config = typeConfig[event.type as keyof typeof typeConfig] || typeConfig.order
          const Icon = config.icon
          const link = event.report_id ? `/reports/${event.report_id}` : undefined

          return (
            <div key={i} className="relative flex gap-4 pl-0">
              {/* Dot */}
              <div className={`w-10 h-10 rounded-full ${config.dotColor} flex items-center justify-center flex-shrink-0 z-10 border-2 border-white dark:border-slate-800`}>
                <Icon className={`w-4 h-4 ${
                  event.type === 'order' ? 'text-blue-600 dark:text-blue-400' :
                  event.type === 'study' ? 'text-green-600 dark:text-green-400' :
                  'text-purple-600 dark:text-purple-400'
                }`} />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {link ? (
                        <Link to={link} className="hover:text-primary-600 dark:hover:text-blue-400 hover:underline">{event.title}</Link>
                      ) : event.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{event.detail}</p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap ml-2">
                    {format(parseISO(event.date), 'dd MMM yyyy HH:mm', { locale: es })}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
