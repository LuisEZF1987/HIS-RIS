import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { ordersApi } from '@/api/orders'
import { patientsApi } from '@/api/patients'
import { reportsApi } from '@/api/reports'
import { Users, ClipboardList, ListChecks, Activity, TrendingUp, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

function StatCard({ title, value, icon: Icon, color, to }: {
  title: string; value?: number; icon: any; color: string; to: string
}) {
  return (
    <Link to={to} className="block bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value ?? '...'}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const { data: patients } = useQuery({
    queryKey: ['patients', 'count'],
    queryFn: () => patientsApi.list({ page: 1, page_size: 1 }),
  })

  const { data: pendingOrders } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: () => ordersApi.list({ status: 'REQUESTED', page: 1 }),
  })

  const { data: scheduledOrders } = useQuery({
    queryKey: ['orders', 'scheduled'],
    queryFn: () => ordersApi.list({ status: 'SCHEDULED', page: 1 }),
  })

  const { data: worklist } = useQuery({
    queryKey: ['worklist'],
    queryFn: () => ordersApi.getWorklist(),
    enabled: ['admin', 'technician', 'radiologist'].includes(user?.role || ''),
  })

  const { data: pendingStudies } = useQuery({
    queryKey: ['studies', 'pending-report'],
    queryFn: () => reportsApi.listStudies(),
    enabled: ['admin', 'radiologist'].includes(user?.role || ''),
    select: (studies) => studies.filter((s) => !s.report_id),
  })

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()}, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1">Resumen del sistema HIS/RIS</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Pacientes"
          value={patients?.total}
          icon={Users}
          color="bg-blue-500"
          to="/patients"
        />
        <StatCard
          title="Órdenes Pendientes"
          value={pendingOrders?.total}
          icon={ClipboardList}
          color="bg-orange-500"
          to="/orders?status=REQUESTED"
        />
        <StatCard
          title="Órdenes Programadas"
          value={scheduledOrders?.total}
          icon={TrendingUp}
          color="bg-purple-500"
          to="/orders?status=SCHEDULED"
        />
        <StatCard
          title="Worklist Activo"
          value={worklist?.length}
          icon={ListChecks}
          color="bg-green-500"
          to="/worklist"
        />
        {['admin', 'radiologist'].includes(user?.role || '') && (
          <StatCard
            title="Sin Informe"
            value={pendingStudies?.length}
            icon={FileText}
            color="bg-red-500"
            to="/reports"
          />
        )}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Órdenes Recientes</h2>
          <Link to="/orders" className="text-primary-600 text-sm hover:underline">Ver todas →</Link>
        </div>
        <RecentOrdersList />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Nuevo Paciente', to: '/patients/new', icon: Users, color: 'bg-blue-50 text-blue-700' },
          { label: 'Nueva Orden', to: '/orders/new', icon: ClipboardList, color: 'bg-orange-50 text-orange-700' },
          { label: 'Ver Worklist', to: '/worklist', icon: ListChecks, color: 'bg-green-50 text-green-700' },
          { label: 'Ver Agenda', to: '/schedule', icon: Activity, color: 'bg-purple-50 text-purple-700' },
        ].map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className={`${action.color} rounded-xl p-4 flex flex-col items-center gap-2 hover:opacity-80 transition-opacity`}
          >
            <action.icon className="w-6 h-6" />
            <span className="text-sm font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function RecentOrdersList() {
  const { data } = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => ordersApi.list({ page: 1, page_size: 5 }),
  })

  if (!data?.items.length) {
    return <p className="text-gray-500 text-sm">No hay órdenes recientes</p>
  }

  const statusColors: Record<string, string> = {
    REQUESTED: 'bg-blue-100 text-blue-700',
    SCHEDULED: 'bg-purple-100 text-purple-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-3">
      {data.items.map((order) => (
        <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div>
            <p className="text-sm font-medium text-gray-900">{order.procedure_description}</p>
            <p className="text-xs text-gray-500">{order.accession_number} · {order.modality}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
              {order.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
