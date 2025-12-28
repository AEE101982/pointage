import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Calendar, Download, FileSpreadsheet, Clock, TrendingUp, DollarSign } from 'lucide-react'

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

      // Récupérer tous les pointages du mois avec infos employé ET paie
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

      // ✅ NOUVEAU : Récupérer les avances approuvées pour ce mois
      const { data: advances, error: advError } = await supabase
        .from('salary_advances')
        .select(`
          *,
          employees (
            id,
            first_name,
            last_name,
            employee_id
          )
        `)
        .eq('month_applied', selectedMonth)
        .eq('status', 'approved')

      if (advError) {
        console.warn('⚠️ Erreur chargement avances:', advError)
        // Continuer même si erreur (table peut ne pas exister)
      }

      console.log('💰 Avances du mois:', advances?.length || 0)

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
            advances: [], // ✅ NOUVEAU
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

      // ✅ NOUVEAU : Ajouter les avances à chaque employé
      advances?.forEach(advance => {
        const empId = advance.employee_id
        if (employeeStats[empId]) {
          employeeStats[empId].advances.push({
            amount: parseFloat(advance.amount),
            date: advance.request_date,
            reason: advance.reason
          })
        }
      })

      // Convertir en tableau et calculer la paie complète
      const statsArray = Object.values(employeeStats).map(stat => {
        const monthlySalary = parseFloat(stat.employee?.monthly_salary || 0)
        const overtimeRate = parseFloat(stat.employee?.overtime_rate || 0)
        const totalOvertimeHours = stat.totalOvertime
        
        // Calcul de la paie
        const overtimePay = totalOvertimeHours * overtimeRate
        const grossSalary = monthlySalary + overtimePay
        
        // ✅ NOUVEAU : Calculer le total des avances
        const totalAdvances = stat.advances.reduce((sum, adv) => sum + adv.amount, 0)
        
        // ✅ NOUVEAU : Salaire net après déduction des avances
        const netSalary = grossSalary - totalAdvances

        return {
          ...stat,
          totalHours: stat.totalHours.toFixed(2),
          totalOvertime: stat.totalOvertime.toFixed(2),
          monthlySalary: monthlySalary.toFixed(2),
          overtimeRate: overtimeRate.toFixed(2),
          overtimePay: overtimePay.toFixed(2),
          totalAdvances: totalAdvances.toFixed(2), // ✅ NOUVEAU
          grossSalary: grossSalary.toFixed(2),     // ✅ NOUVEAU
          netSalary: netSalary.toFixed(2)          // ✅ NOUVEAU
        }
      })

      setAttendanceData(statsArray)
      console.log('✅ Stats mensuelles avec paie:', statsArray)
      
    } catch (error) {
      console.error('Erreur chargement rapport mensuel:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    // ✅ NOUVEAU : Headers avec colonnes paie et avances
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
      'AVANCES (MAD)',          // ✅ NOUVEAU
      'SALAIRE BRUT (MAD)',     // ✅ NOUVEAU
      'SALAIRE NET À PAYER (MAD)' // ✅ NOUVEAU
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
      stat.totalAdvances,        // ✅ NOUVEAU
      stat.grossSalary,          // ✅ NOUVEAU
      stat.netSalary             // ✅ NOUVEAU
    ])

    // ✅ NOUVEAU : Total général
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
      attendanceData.reduce((sum, s) => sum + parseFloat(s.totalAdvances), 0).toFixed(2),  // ✅ NOUVEAU
      attendanceData.reduce((sum, s) => sum + parseFloat(s.grossSalary), 0).toFixed(2),    // ✅ NOUVEAU
      attendanceData.reduce((sum, s) => sum + parseFloat(s.netSalary), 0).toFixed(2)       // ✅ NOUVEAU
    ]

    // Créer le CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      totalRow.map(cell => `"${cell}"`).join(',')
    ].join('\n')

    // Télécharger
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `paie_${selectedMonth}.csv`
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

  // ✅ NOUVEAU : Calculer les totaux pour les stats globales
  const totalGrossSalary = attendanceData.reduce((sum, s) => sum + parseFloat(s.grossSalary), 0)
  const totalAdvances = attendanceData.reduce((sum, s) => sum + parseFloat(s.totalAdvances), 0)
  const totalNetSalary = attendanceData.reduce((sum, s) => sum + parseFloat(s.netSalary), 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rapports Mensuels</h1>
          <p className="mt-2 text-sm text-gray-700">
            Récapitulatif mensuel pour la paie avec avances
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

      {/* Stats globales - AVEC PAIE */}
      {attendanceData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
                <p className="text-sm text-gray-600">Heures Sup.</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {attendanceData.reduce((sum, s) => sum + parseFloat(s.totalOvertime), 0).toFixed(0)}h
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>

          {/* ✅ NOUVEAU : Total Salaires Bruts */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Salaires Bruts</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  {totalGrossSalary.toLocaleString()} MAD
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          {/* ✅ NOUVEAU : Total Avances */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-medium">Avances</p>
                <p className="text-2xl font-bold text-red-600 mt-2">
                  -{totalAdvances.toLocaleString()} MAD
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <DollarSign className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          {/* ✅ NOUVEAU : Total à Payer (Net) */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">TOTAL À PAYER</p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {totalNetSalary.toLocaleString()} MAD
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tableau récapitulatif - AVEC COLONNES PAIE */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Département
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Jours
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Heures
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  H. Sup.
                </th>
                {/* ✅ NOUVEAU : Colonnes Paie */}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Salaire Base
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Prime HS
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-red-600 uppercase">
                  Avances
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-green-600 uppercase font-bold">
                  NET À PAYER
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
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
                      <div className="text-xs text-gray-500">{stat.employee?.employee_id}</div>
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
                      <span className="text-sm font-bold text-blue-600">
                        {stat.totalHours}h
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-orange-600">
                        {stat.totalOvertime}h
                      </span>
                    </td>
                    {/* ✅ NOUVEAU : Colonnes Paie */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {parseFloat(stat.monthlySalary).toLocaleString()} MAD
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-orange-600 font-semibold">
                      +{parseFloat(stat.overtimePay).toLocaleString()} MAD
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 font-semibold">
                      {parseFloat(stat.totalAdvances) > 0 ? `-${parseFloat(stat.totalAdvances).toLocaleString()}` : '-'} MAD
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600 bg-green-50">
                      {parseFloat(stat.netSalary).toLocaleString()} MAD
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
