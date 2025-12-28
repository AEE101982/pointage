import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Calendar, Download, FileSpreadsheet, Clock, TrendingUp } from 'lucide-react'

export default function MonthlyReports() {
  const [attendanceData, setAttendanceData] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Date du mois sélectionné
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadMonthlyAttendance()
  }, [selectedMonth])

  const loadMonthlyAttendance = async () => {
    try {
      setLoading(true)
      
      // Calculer le premier et dernier jour du mois
      const [year, month] = selectedMonth.split('-')
      const firstDay = `${year}-${month}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const lastDayFormatted = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

      console.log('📅 Période:', firstDay, 'à', lastDayFormatted)

      // Récupérer tous les pointages du mois
      const { data: attendanceRecords, error } = await supabase
        .from('attendance')
        .select(`
          *,
          employees (
            id,
            first_name,
            last_name,
            department
          )
        `)
        .gte('date', firstDay)
        .lte('date', lastDayFormatted)
        .order('date', { ascending: true })

      if (error) throw error

      // Grouper par employé
      const employeeStats = {}

      attendanceRecords?.forEach(record => {
        const empId = record.employee_id
        
        if (!employeeStats[empId]) {
          employeeStats[empId] = {
            employee: record.employees,
            totalDays: 0,
            presentDays: 0,
            lateDays: 0,
            totalHours: 0,
            totalOvertime: 0,
            details: []
          }
        }

        employeeStats[empId].totalDays++
        
        if (record.status === 'present') {
          employeeStats[empId].presentDays++
        } else if (record.status === 'late') {
          employeeStats[empId].lateDays++
        }

        employeeStats[empId].totalHours += parseFloat(record.hours_worked || 0)
        employeeStats[empId].totalOvertime += parseFloat(record.overtime_hours || 0)
        
        employeeStats[empId].details.push({
          date: record.date,
          status: record.status,
          check_in_morning: record.check_in_morning,
          check_out_morning: record.check_out_morning,
          check_in_afternoon: record.check_in_afternoon,
          check_out_afternoon: record.check_out_afternoon,
          hours_worked: record.hours_worked,
          overtime_hours: record.overtime_hours
        })
      })

      // Convertir en tableau
      const statsArray = Object.values(employeeStats).map(stat => ({
        ...stat,
        totalHours: stat.totalHours.toFixed(2),
        totalOvertime: stat.totalOvertime.toFixed(2)
      }))

      setAttendanceData(statsArray)
      console.log('✅ Stats mensuelles:', statsArray)
      
    } catch (error) {
      console.error('Erreur chargement rapport mensuel:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    // En-têtes du fichier Excel
    const headers = [
      'Nom',
      'Prénom',
      'Département',
      'Jours travaillés',
      'Jours à l\'heure',
      'Jours en retard',
      'Total heures',
      'Heures supplémentaires'
    ]

    const rows = attendanceData.map(stat => [
      stat.employee?.last_name || '',
      stat.employee?.first_name || '',
      stat.employee?.department || '',
      stat.totalDays,
      stat.presentDays,
      stat.lateDays,
      stat.totalHours,
      stat.totalOvertime
    ])

    // Créer le CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Télécharger
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rapport_mensuel_${selectedMonth}.csv`
    link.click()
  }

  const exportDetailedExcel = () => {
    // Export détaillé avec toutes les dates
    const headers = [
      'Nom',
      'Prénom',
      'Département',
      'Date',
      'Arrivée Matin',
      'Sortie Pause',
      'Retour PM',
      'Sortie Soir',
      'Heures',
      'H. Sup.',
      'Statut'
    ]

    const rows = []
    
    attendanceData.forEach(stat => {
      stat.details.forEach(detail => {
        rows.push([
          stat.employee?.last_name || '',
          stat.employee?.first_name || '',
          stat.employee?.department || '',
          detail.date,
          detail.check_in_morning || '-',
          detail.check_out_morning || '-',
          detail.check_in_afternoon || '-',
          detail.check_out_afternoon || '-',
          detail.hours_worked || '0',
          detail.overtime_hours || '0',
          detail.status === 'present' ? 'À l\'heure' : detail.status === 'late' ? 'Retard' : 'Absent'
        ])
      })
    })

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rapport_detaille_${selectedMonth}.csv`
    link.click()
  }

  const getMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(year, parseInt(month) - 1)
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
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
          <h1 className="text-3xl font-bold text-gray-900">Rapports Mensuels</h1>
          <p className="mt-2 text-sm text-gray-700">
            Récapitulatif mensuel pour la paie
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            disabled={attendanceData.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            Export Résumé
          </button>
          <button
            onClick={exportDetailedExcel}
            disabled={attendanceData.length === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Export Détaillé
          </button>
        </div>
      </div>

      {/* Sélecteur de mois */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            Mois
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {getMonthName(selectedMonth)}
          </p>
        </div>
      </div>

      {/* Stats globales */}
      {attendanceData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Employés</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{attendanceData.length}</p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-full">
                <Clock className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Heures</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {attendanceData.reduce((sum, s) => sum + parseFloat(s.totalHours), 0).toFixed(0)}h
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Heures Sup. Total</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {attendanceData.reduce((sum, s) => sum + parseFloat(s.totalOvertime), 0).toFixed(0)}h
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Jours Travaillés</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {attendanceData.reduce((sum, s) => sum + s.totalDays, 0)}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <Calendar className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tableau récapitulatif */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Département
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jours
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  À l'heure
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retards
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Heures
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  H. Sup.
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    Aucune donnée pour ce mois
                  </td>
                </tr>
              ) : (
                attendanceData.map((stat, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {stat.employee?.first_name} {stat.employee?.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.employee?.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-gray-900">
                        {stat.totalDays}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-green-600">
                        {stat.presentDays}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-orange-600">
                        {stat.lateDays}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-blue-600">
                        {stat.totalHours}h
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-orange-600">
                        {stat.totalOvertime}h
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
