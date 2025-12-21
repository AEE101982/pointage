import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { Users, UserCheck, UserX, Clock, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0
  })
  const [recentAttendance, setRecentAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()

    // ✅ MISE À JOUR AUTOMATIQUE : Écouter les changements en temps réel
    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        () => {
          console.log('✅ Changement détecté - Mise à jour du dashboard')
          loadDashboardData()
        }
      )
      .subscribe()

    // Nettoyer l'abonnement quand le composant est démonté
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadDashboardData = async () => {
    try {
      // Compter les employés
      const { data: employees } = await supabase
        .from('employees')
        .select('id')
      
      // Pointages d'aujourd'hui
      const today = new Date().toISOString().split('T')[0]
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*, employees(first_name, last_name, photo_url)')
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(10)

      const present = attendance?.filter(a => a.status === 'present').length || 0
      const late = attendance?.filter(a => a.status === 'late').length || 0
      const absent = attendance?.filter(a => a.status === 'absent').length || 0
      
      const totalEmployees = employees?.length || 0
      const notPointedYet = totalEmployees - (present + late + absent)

      setStats({
        totalEmployees,
        presentToday: present,
        absentToday: absent + notPointedYet, // Absents + non pointés
        lateToday: late
      })

      setRecentAttendance(attendance || [])
    } catch (error) {
      console.error('Erreur chargement dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="mt-2 text-sm text-gray-700">
          Vue d'ensemble de la présence des employés
        </p>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total employés */}
        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-gray-100 rounded-lg">
                <Users className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total employés
                  </dt>
                  <dd className="text-3xl font-bold text-gray-900">
                    {stats.totalEmployees}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Présents */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-white/20 rounded-lg">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-green-100 truncate">
                    Présents aujourd'hui
                  </dt>
                  <dd className="text-3xl font-bold text-white">
                    {stats.presentToday}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Retards */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-white/20 rounded-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-orange-100 truncate">
                    Retards aujourd'hui
                  </dt>
                  <dd className="text-3xl font-bold text-white">
                    {stats.lateToday}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Absents */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-white/20 rounded-lg">
                <UserX className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-red-100 truncate">
                    Absents aujourd'hui
                  </dt>
                  <dd className="text-3xl font-bold text-white">
                    {stats.absentToday}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Derniers pointages */}
      <div className="bg-white shadow-lg rounded-xl">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Derniers pointages
          </h3>
        </div>
        <div className="px-6 py-5">
          {recentAttendance.length > 0 ? (
            <div className="space-y-3">
              {recentAttendance.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    {record.employees?.photo_url ? (
                      <img 
                        src={record.employees.photo_url} 
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {record.employees?.first_name?.[0]}{record.employees?.last_name?.[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {record.employees?.first_name} {record.employees?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Arrivée: {record.check_in || 'N/A'}
                        {record.check_out && ` • Départ: ${record.check_out}`}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    record.status === 'present' ? 'bg-green-100 text-green-800' :
                    record.status === 'late' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {record.status === 'present' ? '✅ Présent' :
                     record.status === 'late' ? '⏰ Retard' : '⚠️ Absent'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              Aucun pointage aujourd'hui
            </p>
          )}
        </div>
      </div>
    </div>
  )
}