import { NavLink } from 'react-router-dom'
import { LayoutDashboard, QrCode, Users, FileText, Settings, Clock } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export default function Sidebar() {
  const { role } = useAuth()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/scan', icon: QrCode, label: 'Scanner QR' },
    { to: '/employees', icon: Users, label: 'Employés' },
    { to: '/reports', icon: FileText, label: 'Rapports' },
  ]

  if (role === 'admin') {
    navItems.push({ to: '/users', icon: Settings, label: 'Utilisateurs' })
  }

  return (
    <>
      {/* Sidebar Desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gradient-to-b from-indigo-600 to-purple-700 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-3 text-white mt-4">
            <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
            <span className="font-bold text-xl">Pointage Pro</span>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `group flex gap-x-3 rounded-lg p-3 text-sm leading-6 font-semibold transition-all ${
                            isActive
                              ? 'bg-white/20 text-white shadow-lg'
                              : 'text-indigo-100 hover:text-white hover:bg-white/10'
                          }`
                        }
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <nav className="flex justify-around">
          {navItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 ${
                  isActive ? 'text-indigo-600' : 'text-gray-500'
                }`
              }
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  )
}