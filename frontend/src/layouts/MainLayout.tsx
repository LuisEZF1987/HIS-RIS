import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { authApi } from '@/api/auth'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, FileText, Calendar, Settings,
  ClipboardList, ListChecks, Menu, X, LogOut, User,
  Stethoscope, Sun, Moon,
} from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard',       icon: LayoutDashboard, roles: ['admin', 'receptionist', 'technician', 'radiologist', 'physician'] },
  { to: '/patients',  label: 'Pacientes',        icon: Users,           roles: ['admin', 'receptionist', 'radiologist', 'physician'] },
  { to: '/orders',    label: 'Órdenes',           icon: ClipboardList,   roles: ['admin', 'receptionist', 'technician', 'radiologist', 'physician'] },
  { to: '/worklist',  label: 'Worklist DICOM',   icon: ListChecks,      roles: ['admin', 'technician', 'radiologist'] },
  { to: '/reports',   label: 'Informes',          icon: FileText,        roles: ['admin', 'radiologist', 'physician'] },
  { to: '/schedule',  label: 'Agenda',            icon: Calendar,        roles: ['admin', 'receptionist', 'technician'] },
  { to: '/admin',     label: 'Administración',    icon: Settings,        roles: ['admin'] },
]

export default function MainLayout() {
  const { user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore()
  const navigate = useNavigate()

  // Sync dark class on mount (in case hydration happened before this component rendered)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout()
    navigate('/login')
    toast.success('Sesión cerrada')
  }

  const visibleNav = navItems.filter((item) => !user || item.roles.includes(user.role))

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 shadow-lg transition-all duration-300 flex flex-col',
        'bg-white dark:bg-gray-900',
        sidebarOpen ? 'w-64' : 'w-16',
      )}>

        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <img
              src={theme === 'dark' ? '/logo.png' : '/logo1.png'}
              alt="Dimed"
              className="h-8 w-8 object-contain flex-shrink-0"
            />
            {sidebarOpen && (
              <div>
                <p className="font-bold text-sm text-gray-900 dark:text-white">Dimed HIS/RIS</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sistema Hospitalario</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-700 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center text-gray-400 hover:text-red-500"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className={clsx(
        'flex-1 flex flex-col transition-all duration-300',
        sidebarOpen ? 'ml-64' : 'ml-16',
      )}>

        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 shadow-sm transition-colors duration-200">
          <button
            onClick={toggleSidebar}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mr-4"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1" />

          {/* Right side: user info + theme toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Stethoscope className="w-4 h-4" />
              <span className="font-medium">{user?.full_name}</span>
              <span className="text-gray-400 dark:text-gray-600">·</span>
              <span className="capitalize text-primary-600 dark:text-blue-400">{user?.role}</span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className={clsx(
                'ml-2 p-2 rounded-full transition-all duration-200',
                theme === 'dark'
                  ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
