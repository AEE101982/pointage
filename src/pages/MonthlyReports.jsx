import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Calendar, Download, FileSpreadsheet, Clock, TrendingUp, DollarSign } from 'lucide-react'

export default function MonthlyReports() {
  const [attendanceData, setAttendanceData] = useState([])
  const [loading, setLoading] = useState(true)
  
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
      
      const [year, month] = selectedMonth.split('-')
      const firstDay = `${year}-${month}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const lastDayFormatted = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

      // Récupérer tous les pointages du mois avec infos employé
      const { data: attendanceRecords, error } = await supabase
        .from('attendance')
        .select(`
          *,
          employees (
            id,
            first_name,
            last_name,
            department,
            employee_id,
            monthly_salary,
            hourly_rate,
            overtime_rate,
            contract_type,
            hire_date
          )
        `)
        .gte('date', firstDay)
        .lte('date', lastDayFormatted)
        .order('date', { ascending: true })

      if (error) throw error

      // Grouper par employé et calculer la paie
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

      // Convertir en tableau et calculer la paie
      const statsArray = Object.values(employeeStats).map(stat => {
        const monthlySalary = parseFloat(stat.employee?.monthly_salary || 0)
        const overtimeRate = parseFloat(stat.employee?.overtime_rate || 0)
        const totalOvertimeHours = stat.totalOvertime
        
        // Calcul de la paie totale
        const overtimePay = totalOvertimeHours * overtimeRate
        const totalSalary = monthlySalary + overtimePay

        return {
          ...stat,
          totalHours: stat.totalHours.toFixed(2),
          totalOvertime: stat.totalOvertime.toFixed(2),
          monthlySalary: monthlySalary.toFixed(2),
          overtimeRate: overtimeRate.toFixed(2),
          overtimePay: overtimePay.toFixed(2),
          totalSalary: totalSalary.toFixed(2)
        }
      })

      setAttendanceData(statsArray)
      
    } catch (error) {
      console.error('Erreur chargement rapport mensuel:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    const headers = [
      'Matricule',
      'Nom',
      'Prénom',
      'Département',
      'Type Contrat',
      'Jours travaillés',
      'Jours à l\'heure',
      'Jours en retard',
      'Total heures',
      'Heures supplémentaires',
      'Salaire mensuel (MAD)',
      'Taux HS (MAD/h)',
      'Prime HS (MAD)',
      'TOTAL À PAYER (MAD)'
    ]

    const rows = attendanceData.map(stat => [
      stat.employee?.employee_id || '',
      stat.employee?.last_name || '',
      stat.employee?.first_name || '',
      stat.employee?.department || '',
      stat.employee?.contract_type || '',
      stat.totalDays,
      stat.presentDays,
      stat.lateDays,
      stat.totalHours,
      stat.totalOvertime,
      stat.monthlySalary,
      stat.overtimeRate,
      stat.overtimePay,
      stat.totalSalary
    ])

    // Total général
    const totalRow = [
      '',
      '',
      'TOTAL GÉNÉRAL',
      '',
      '',
      attendanceData.reduce((sum, s) => sum + s.totalDays, 0),
      attendanceData.reduce((sum, s) => sum + s.presentDays, 0),
      attendanceData.reduce((sum, s) => sum + s.lateDays, 0),
      attendanceData.reduce((sum, s) => sum + parseFloat(s.totalHours), 0).toFixed(2),
      attendanceData.reduce((sum, s) => sum + parseFloat(s.totalOvertime), 0).toFixed(2),
      attendanceData.reduce((sum, s) => sum + parseFloat(s.monthlySalary), 0).toFixed(2),
      '',
      attendanceData.reduce((sum, s) => sum + parseFloat(s.overtimePay), 0).toFixed(2),
      attendanceData.reduce((sum, s) => sum + parseFloat(s.totalSalary), 0).toFixed(2)
    ]

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      totalRow.map(cell => `"${cell}"`).join(',')
    ].join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `paie_${selectedMonth}.csv`
    link.click()
  }

  const exportDetailedExcel = () => {
    const headers = [
      'Matricule',
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
          stat.employee?.employee_id || '',
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
    link.download = `details_${selectedMonth}.csv`
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

  const totalPayroll = attendanceData.reduce((sum, s) => sum + parseFloat(s.totalSalary), 0)
  const totalOvertimePay = attendanceData.reduce((sum, s) => sum + parseFloat(s.overtimePay), 0)
  const totalBaseSalary = attendanceData.reduce((sum, s) => sum + parseFloat(s.monthlySalary), 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rapports de Paie Mensuelle</h1>
          <p className="mt-2 text-sm text-gray-700">
            Calcul automatique des salaires avec heures supplémentaires
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            disabled={attendanceData.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            Export Paie
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
                <p className="text-sm text-gray-600">Salaires de base</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {totalBaseSalary.toLocaleString()} MAD
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Primes HS</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {totalOvertimePay.toLocaleString()} MAD
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
                <p className="text-sm text-gray-600">TOTAL PAIE</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {totalPayroll.toLocaleString()} MAD
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Heures Sup. Total</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {attendanceData.reduce((sum, s) => sum + parseFloat(s.totalOvertime), 0).toFixed(0)}h
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <Clock className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tableau de paie */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matricule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Jours</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">H. Normales</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">H. Sup.</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Salaire base</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prime HS</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-green-50">TOTAL</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    Aucune donnée pour ce mois
                  </td>
                </tr>
              ) : (
                attendanceData.map((stat, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.employee?.employee_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {stat.employee?.first_name} {stat.employee?.last_name}
                      </div>
                      <div className="text-xs text-gray-500">{stat.employee?.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-900">
                      {stat.totalDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {stat.totalHours}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-orange-600">
                      {stat.totalOvertime}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {parseFloat(stat.monthlySalary).toLocaleString()} MAD
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-orange-600">
                      {parseFloat(stat.overtimePay).toLocaleString()} MAD
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600 bg-green-50">
                      {parseFloat(stat.totalSalary).toLocaleString()} MAD
                    </td>
                  </tr>
                ))
              )}
              
              {/* Ligne de total */}
              {attendanceData.length > 0 && (
                <tr className="bg-gray-100 font-bold">
                  <td className="px-6 py-4 text-sm"></td>
                  <td className="px-6 py-4 text-sm">TOTAL GÉNÉRAL</td>
                  <td className="px-6 py-4 text-center text-sm">
                    {attendanceData.reduce((sum, s) => sum + s.totalDays, 0)}
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    {attendanceData.reduce((sum, s) => sum + parseFloat(s.totalHours), 0).toFixed(0)}h
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-orange-600">
                    {attendanceData.reduce((sum, s) => sum + parseFloat(s.totalOvertime), 0).toFixed(0)}h
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    {totalBaseSalary.toLocaleString()} MAD
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-orange-600">
                    {totalOvertimePay.toLocaleString()} MAD
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-green-600 bg-green-100">
                    {totalPayroll.toLocaleString()} MAD
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
