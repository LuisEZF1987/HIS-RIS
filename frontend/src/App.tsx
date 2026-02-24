import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import MainLayout from '@/layouts/MainLayout'
import AuthLayout from '@/layouts/AuthLayout'
import LoginPage from '@/pages/Login/LoginPage'
import DashboardPage from '@/pages/Dashboard/DashboardPage'
import PatientsListPage from '@/pages/Patients/PatientsListPage'
import PatientDetailPage from '@/pages/Patients/PatientDetailPage'
import NewPatientPage from '@/pages/Patients/NewPatientPage'
import OrdersListPage from '@/pages/Orders/OrdersListPage'
import NewOrderPage from '@/pages/Orders/NewOrderPage'
import WorklistPage from '@/pages/Orders/WorklistPage'
import ReportsListPage from '@/pages/Reports/ReportsListPage'
import ReportEditorPage from '@/pages/Reports/ReportEditorPage'
import SchedulePage from '@/pages/Schedule/SchedulePage'
import AdminPage from '@/pages/Admin/AdminPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/patients" element={<PatientsListPage />} />
          <Route path="/patients/new" element={<NewPatientPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />

          <Route path="/orders" element={<OrdersListPage />} />
          <Route path="/orders/new" element={<NewOrderPage />} />
          <Route path="/worklist" element={<WorklistPage />} />

          <Route path="/reports" element={<ReportsListPage />} />
          <Route path="/reports/:id" element={<ReportEditorPage />} />

          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
