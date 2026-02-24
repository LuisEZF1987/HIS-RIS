import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { patientsApi } from '@/api/patients'
import { ordersApi } from '@/api/orders'
import { ArrowLeft, Phone, Mail, ClipboardList, Plus } from 'lucide-react'
import { format, parseISO, differenceInYears } from 'date-fns'
import { es } from 'date-fns/locale'

const statusColors: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsApi.get(Number(id)),
  })

  const { data: ordersData } = useQuery({
    queryKey: ['orders', { patient_id: id }],
    queryFn: () => ordersApi.list({ patient_id: Number(id), page: 1, page_size: 10 }),
    enabled: !!id,
  })

  if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando...</div>
  if (!patient) return <div className="p-8 text-center text-red-500">Paciente no encontrado</div>

  const age = patient.date_of_birth
    ? differenceInYears(new Date(), parseISO(patient.date_of_birth))
    : null

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/patients" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{patient.full_name}</h1>
          <p className="text-gray-500 text-sm font-mono">MRN: {patient.mrn}</p>
        </div>
        <div className="ml-auto">
          <Link
            to={`/orders/new?patient_id=${patient.id}`}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nueva Orden
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Patient info */}
        <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Información Personal</h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">Edad</p>
              <p className="font-medium">{age !== null ? `${age} años` : '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Fecha Nac.</p>
              <p className="font-medium">
                {patient.date_of_birth ? format(parseISO(patient.date_of_birth), 'dd MMMM yyyy', { locale: es }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Género</p>
              <p className="font-medium">
                {{ M: 'Masculino', F: 'Femenino', O: 'Otro', U: 'N/E' }[patient.gender || 'U']}
              </p>
            </div>
            <div>
              <p className="text-gray-500">DNI</p>
              <p className="font-medium">{patient.dni || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Grupo Sanguíneo</p>
              <p className="font-medium">{patient.blood_type || '—'}</p>
            </div>
            {patient.allergies && (
              <div>
                <p className="text-gray-500">Alergias</p>
                <p className="font-medium text-red-600">{patient.allergies}</p>
              </div>
            )}
          </div>

          {patient.contacts.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Contacto</h3>
              {patient.contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  {c.contact_type === 'phone' ? (
                    <Phone className="w-3 h-3 text-gray-400" />
                  ) : (
                    <Mail className="w-3 h-3 text-gray-400" />
                  )}
                  <span className="text-gray-600">{c.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Órdenes de Imagen</h2>
            <ClipboardList className="w-5 h-5 text-gray-400" />
          </div>

          {!ordersData?.items.length ? (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No hay órdenes para este paciente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ordersData.items.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.procedure_description}</p>
                    <p className="text-xs text-gray-500">
                      {order.accession_number} · {order.modality} · {format(parseISO(order.requested_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
