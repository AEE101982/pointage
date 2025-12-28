import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { 
  LayoutDashboard, 
  Users, 
  QrCode, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  UserCircle,
  DollarSign,
  Calendar
} from 'lucide-react'
import { useState } from 'react'

export default function Layout({ children, user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  const navigation = [
    { name: 'Tableau de bord', path: '/', icon: LayoutDashboard },
    { name: 'Employés', path: '/employees', icon: Users },
    { name: 'Scanner', path: '/scan', icon: QrCode },
    { name: 'Rapports', path: '/reports', icon: FileText },
    { name: 'Rapports Mensuels', path: '/monthly-reports', icon: Calendar },
    { name: 'Avances sur Salaire', path: '/salary-advances', icon: DollarSign }
  ]

  // Menu admin uniquement
  const adminNavigation = user?.role === 'admin' ? [
    { name: 'Utilisateurs', path: '/users', icon: UserCircle },
    { name: 'Paramètres', path: '/settings', icon: Settings }
  ] : []

  const allNavigation = [...navigation, ...adminNavigation]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header Mobile */}
      <div className="md:hidden bg-white shadow-lg sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-red-800">Sahara Mobilier</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>

        {/* Menu Mobile Déroulant */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white">
            <div className="px-2 py-3 space-y-1">
              {allNavigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isActive(item.path)
                        ? 'bg-red-50 text-red-800 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                )
              })}

              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                Déconnexion
              </button>
            </div>

            {/* Info utilisateur en bas du menu mobile */}
            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
              <p className="text-sm font-medium text-gray-900">{user?.full_name || user?.email}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
              <p className="text-xs text-gray-500 capitalize mt-1">
                {user?.role === 'admin' ? '👑 Administrateur' : '👤 Utilisateur'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 md:bg-white md:border-r md:border-gray-200">
        <div className="flex flex-col flex-1 min-h-0">
          {/* En-tête avec logo Sahara */}
          <div className="flex flex-col items-center justify-center h-24 px-6 bg-gradient-to-r from-red-800 to-red-900">
            <h1 className="text-2xl font-bold text-white">Sahara Mobilier</h1>
            <p className="text-xs text-red-100 mt-1">Gestion RH</p>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {allNavigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive(item.path)
                      ? 'bg-red-50 text-red-800 font-semibold shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Info utilisateur et déconnexion */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="mb-3 px-4 py-2 bg-white rounded-lg shadow-sm">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              <span className={`inline-flex items-center gap-1 px-2 py-1 mt-2 text-xs font-semibold rounded-full ${
                user?.role === 'admin' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {user?.role === 'admin' ? '👑 Admin' : '👤 Utilisateur'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="md:pl-64">
        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
