import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Calendar, Download, Filter, Clock } from 'lucide-react'

export default function Reports() {
  const [attendanceData, setAttendanceData] = useState([])
  const [loading, setLoading] = useState(true)
  
  const getLocalDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const [selectedDate, setSelectedDate] = useState(getLocalDate())
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    loadAttendance()
    
    const channel = supabase
      .channel('reports-attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `date=eq.${selectedDate}`
        },
        (payload) => {
          console.log('🔄 Mise à jour rapport temps réel')
          loadAttendance()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDate, filterDepartment])

  const loadDepartments = async () => {
    try {
      const { data } = await supabase
        .from('employees')
        .select('department')
        .not('department', 'is', null)

      const uniqueDepts = [...new Set(data?.map(e => e.department) || [])]
      setDepartments(uniqueDepts)
    } catch (error) {
      console.error('Erreur chargement départements:', error)
    }
  }

  const loadAttendance = async () => {
    try {
      setLoading(true)
      
      console.log('📅 Recherche pour la date:', selectedDate)
      
      // ✅ CORRECTION : Ne pas chercher employee_id dans employees
      let query = supabase
        .from('attendance')
        .select(`
          *,
          employees (
            id,
            first_name,
            last_name,
            department,
            qr_code
          )
        `)
        .eq('date', selectedDate)
        .order('created_at', { ascending: true })

      const { data, error } = await query

      if (error) {
        console.error('❌ Erreur SQL:', error)
        throw error
      }

      console.log('✅ Pointages trouvés:', data?.length || 0)

      let filteredData = data || []

      if (filterDepartment !== 'all') {
        filteredData = filteredData.filter(
          record => record.employees?.department === filterDepartment
        )
      }

      setAttendanceData(filteredData)
    } catch (error) {
      console.error('Erreur chargement présences:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Nom',
      'Département',
      'Arrivée Matin',
      'Sortie Pause',
      'Retour Après-midi',
      'Sortie Soir',
      'Heures',
      'H. Sup.',
      'Statut'
    ]

    const rows = attendanceData.map(record => [
      `${record.employees?.first_name || ''} ${record.employees?.last_name || ''}`.trim(),
      record.employees?.department || '-',
      record.check_in_morning || '-',
      record.check_out_morning || '-',
      record.check_in_afternoon || '-',
      record.check_out_afternoon || '-',
      record.hours_worked ? `${record.hours_worked}h` : '0h',
      record.overtime_hours ? `${record.overtime_hours}h` : '0h',
      record.status === 'present' ? 'À l\'heure' : record.status === 'late' ? 'Retard' : 'Absent'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rapport_pointage_${selectedDate}.csv`
    link.click()
  }

  const getStatusBadge = (status) => {
    const badges = {
      present: { text: 'À l\'heure', color: 'bg-green-100 text-green-800' },
      late: { text: 'Retard', color: 'bg-orange-100 text-orange-800' },
      absent: { text: 'Absent', color: 'bg-red-100 text-red-800' }
    }
    return badges[status] || badges.absent
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rapports de Pointage</h1>
          <p className="mt-2 text-sm text-gray-700">
            Suivi des présences et heures travaillées
            <span className="ml-2 inline-flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
              <span className="text-xs text-green-600">Temps réel</span>
            </span>
          </p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={attendanceData.length === 0}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          Exporter CSV
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="inline w-4 h-4 mr-1" />
              Département
            </label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tous les départements</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Département
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arrivée Matin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sortie Pause
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retour PM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sortie Soir
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Heures
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  H. Sup.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p className="font-semibold">Aucun pointage pour cette date</p>
                    <p className="text-sm mt-2">Date: {selectedDate}</p>
                    <button
                      onClick={() => setSelectedDate(getLocalDate())}
                      className="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      Retour à aujourd'hui
                    </button>
                  </td>
                </tr>
              ) : (
                attendanceData.map((record) => {
                  const badge = getStatusBadge(record.status)
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.employees?.first_name} {record.employees?.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.employees?.department || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {record.check_in_morning ? (
                          <span className="text-green-600 font-semibold">
                            ↓ {record.check_in_morning.substring(0, 5)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {record.check_out_morning ? (
                          <span className="text-gray-600">
                            ↑ {record.check_out_morning.substring(0, 5)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {record.check_in_afternoon ? (
                          <span className="text-blue-600 font-semibold">
                            ↓ {record.check_in_afternoon.substring(0, 5)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {record.check_out_afternoon ? (
                          <span className="text-gray-600">
                            ↑ {record.check_out_afternoon.substring(0, 5)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {record.hours_worked ? `${record.hours_worked}h` : '0h'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                        {record.overtime_hours && parseFloat(record.overtime_hours) > 0
                          ? `${record.overtime_hours}h`
                          : '0h'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.color}`}>
                          {badge.text}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Stats en bas */}
        {attendanceData.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total employés:</span>
                <span className="ml-2 font-semibold text-gray-900">{attendanceData.length}</span>
              </div>
              <div>
                <span className="text-gray-600">À l'heure:</span>
                <span className="ml-2 font-semibold text-green-600">
                  {attendanceData.filter(r => r.status === 'present').length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">En retard:</span>
                <span className="ml-2 font-semibold text-orange-600">
                  {attendanceData.filter(r => r.status === 'late').length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total heures sup:</span>
                <span className="ml-2 font-semibold text-orange-600">
                  {attendanceData
                    .reduce((sum, r) => sum + (parseFloat(r.overtime_hours) || 0), 0)
                    .toFixed(2)}h
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
