import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Calendar, Download, Copy, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Reports() {
  const [reportType, setReportType] = useState('daily')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedWeek, setSelectedWeek] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7))
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState([])

  useEffect(() => {
    loadEmployees()
    generateReport()
  }, [reportType, selectedDate, selectedWeek, selectedMonth])

  const loadEmployees = async () => {
    const { data } = await supabase.from('employees').select('*')
    setEmployees(data || [])
  }

  const generateReport = async () => {
    setLoading(true)
    try {
      let data = []

      if (reportType === 'daily') {
        data = await getDailyReport(selectedDate)
      } else if (reportType === 'weekly') {
        data = await getWeeklyReport(selectedWeek)
      } else if (reportType === 'monthly') {
        data = await getMonthlyReport(selectedMonth)
      }

      setReportData(data)
    } catch (error) {
      console.error('Erreur génération rapport:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDailyReport = async (date) => {
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, employees(first_name, last_name, department, matricule)')
      .eq('date', date)
      .order('check_in', { ascending: true })

    // Ajouter les absents
    const presentIds = attendance?.map(a => a.employee_id) || []
    const absent = employees
      .filter(emp => !presentIds.includes(emp.id))
      .map(emp => ({
        employee_name: `${emp.first_name} ${emp.last_name}`,
        matricule: emp.matricule,
        department: emp.department,
        status: 'absent',
        check_in: '-',
        check_out: '-',
        hours_worked: '0'
      }))

    const present = attendance?.map(a => ({
      employee_name: `${a.employees.first_name} ${a.employees.last_name}`,
      matricule: a.employees.matricule,
      department: a.employees.department,
      status: a.status,
      check_in: a.check_in || '-',
      check_out: a.check_out || '-',
      hours_worked: a.hours_worked || '0',
      overtime_hours: a.overtime_hours || '0'
    })) || []

    return [...present, ...absent]
  }

  const getWeeklyReport = async (weekStart) => {
    if (!weekStart) return []

    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, employees(first_name, last_name, matricule)')
      .gte('date', start.toISOString().split('T')[0])
      .lte('date', end.toISOString().split('T')[0])

    // Grouper par employé
    const byEmployee = {}
    employees.forEach(emp => {
      byEmployee[emp.id] = {
        employee_name: `${emp.first_name} ${emp.last_name}`,
        matricule: emp.matricule,
        days: {},
        total_hours: 0,
        total_overtime: 0,
        days_present: 0
      }
    })

    attendance?.forEach(a => {
      if (byEmployee[a.employee_id]) {
        byEmployee[a.employee_id].days[a.date] = {
          status: a.status,
          hours: parseFloat(a.hours_worked || 0)
        }
        byEmployee[a.employee_id].total_hours += parseFloat(a.hours_worked || 0)
        byEmployee[a.employee_id].total_overtime += parseFloat(a.overtime_hours || 0)
        if (a.status === 'present' || a.status === 'late') {
          byEmployee[a.employee_id].days_present++
        }
      }
    })

    return Object.values(byEmployee)
  }

  const getMonthlyReport = async (month) => {
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, employees(first_name, last_name, matricule, department)')
      .gte('date', `${month}-01`)
      .lt('date', `${month}-32`)

    // Compter les jours ouvrables du mois (Lun-Ven)
    const year = parseInt(month.split('-')[0])
    const monthNum = parseInt(month.split('-')[1])
    const daysInMonth = new Date(year, monthNum, 0).getDate()
    let workingDays = 0
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNum - 1, day)
      const dayOfWeek = date.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Pas dimanche ni samedi
        workingDays++
      }
    }

    // Grouper par employé
    const byEmployee = {}
    employees.forEach(emp => {
      byEmployee[emp.id] = {
        employee_name: `${emp.first_name} ${emp.last_name}`,
        matricule: emp.matricule,
        department: emp.department,
        working_days: workingDays,
        days_worked: 0,
        days_present: 0,
        days_late: 0,
        days_absent: 0,
        total_hours: 0,
        total_overtime: 0,
        attendance_rate: 0,
        late_minutes: 0
      }
    })

    // Calculer les présences
    attendance?.forEach(a => {
      if (byEmployee[a.employee_id]) {
        const empId = a.employee_id

        byEmployee[empId].days_worked++
        byEmployee[empId].total_hours += parseFloat(a.hours_worked || 0)
        byEmployee[empId].total_overtime += parseFloat(a.overtime_hours || 0)
        
        if (a.status === 'present') {
          byEmployee[empId].days_present++
        } else if (a.status === 'late') {
          byEmployee[empId].days_late++
          
          // Calculer les minutes de retard
          if (a.check_in) {
            const [hours, minutes] = a.check_in.split(':').map(Number)
            const arrivalMinutes = hours * 60 + minutes
            const expectedMinutes = 9 * 60 // 9h00
            if (arrivalMinutes > expectedMinutes) {
              byEmployee[empId].late_minutes += (arrivalMinutes - expectedMinutes)
            }
          }
        }
      }
    })

    // Calculer les absences (jours ouvrables - jours travaillés)
    Object.keys(byEmployee).forEach(empId => {
      const emp = byEmployee[empId]
      emp.days_absent = workingDays - emp.days_worked
      
      // Taux de présence
      if (workingDays > 0) {
        emp.attendance_rate = ((emp.days_worked / workingDays) * 100).toFixed(1)
      }
    })

    return Object.values(byEmployee)
  }

  const exportToExcel = () => {
    let ws_data = []

    if (reportType === 'daily') {
      ws_data = [
        ['Rapport Journalier - ' + selectedDate],
        [],
        ['Matricule', 'Nom', 'Département', 'Arrivée', 'Départ', 'Heures', 'Heures Sup.', 'Statut'],
        ...reportData.map(r => [
          r.matricule,
          r.employee_name,
          r.department,
          r.check_in,
          r.check_out,
          r.hours_worked,
          r.overtime_hours || '0',
          r.status === 'present' ? 'Présent' : r.status === 'late' ? 'Retard' : 'Absent'
        ])
      ]
    } else if (reportType === 'weekly') {
      ws_data = [
        ['Rapport Hebdomadaire - Semaine du ' + selectedWeek],
        [],
        ['Matricule', 'Nom', 'Jours Présents', 'Total Heures', 'Heures Sup.'],
        ...reportData.map(r => [
          r.matricule,
          r.employee_name,
          r.days_present,
          r.total_hours.toFixed(2),
          r.total_overtime.toFixed(2)
        ])
      ]
    } else {
      ws_data = [
        ['Rapport Mensuel - ' + selectedMonth],
        [],
        ['Matricule', 'Nom', 'Département', 'J. Ouvrables', 'J. Travaillés', 'Présent', 'Retards', 'Absences', 'Total Heures', 'Heures Sup.', 'Taux %'],
        ...reportData.map(r => [
          r.matricule,
          r.employee_name,
          r.department,
          r.working_days,
          r.days_worked,
          r.days_present,
          r.days_late + (r.late_minutes > 0 ? ` (${Math.floor(r.late_minutes / 60)}h${r.late_minutes % 60}min)` : ''),
          r.days_absent,
          r.total_hours.toFixed(2),
          r.total_overtime.toFixed(2),
          r.attendance_rate + '%'
        ])
      ]
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(ws_data)
    
    // Largeur des colonnes
    ws['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 }
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Rapport')
    XLSX.writeFile(wb, `Rapport_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const copyToClipboard = () => {
    let text = ''

    if (reportType === 'daily') {
      text = 'Matricule\tNom\tDépartement\tArrivée\tDépart\tHeures\tHeures Sup.\tStatut\n'
      reportData.forEach(r => {
        text += `${r.matricule}\t${r.employee_name}\t${r.department}\t${r.check_in}\t${r.check_out}\t${r.hours_worked}\t${r.overtime_hours || '0'}\t${r.status === 'present' ? 'Présent' : r.status === 'late' ? 'Retard' : 'Absent'}\n`
      })
    } else if (reportType === 'weekly') {
      text = 'Matricule\tNom\tJours Présents\tTotal Heures\tHeures Sup.\n'
      reportData.forEach(r => {
        text += `${r.matricule}\t${r.employee_name}\t${r.days_present}\t${r.total_hours.toFixed(2)}\t${r.total_overtime.toFixed(2)}\n`
      })
    } else {
      text = 'Matricule\tNom\tDépartement\tJ. Ouvrables\tJ. Travaillés\tPrésent\tRetards\tAbsences\tTotal Heures\tHeures Sup.\tTaux %\n'
      reportData.forEach(r => {
        text += `${r.matricule}\t${r.employee_name}\t${r.department}\t${r.working_days}\t${r.days_worked}\t${r.days_present}\t${r.days_late}\t${r.days_absent}\t${r.total_hours.toFixed(2)}\t${r.total_overtime.toFixed(2)}\t${r.attendance_rate}%\n`
      })
    }

    navigator.clipboard.writeText(text)
    alert('✅ Données copiées ! Vous pouvez maintenant les coller dans Excel (Ctrl+V)')
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Rapports de présence</h1>
        <p className="mt-2 text-sm text-gray-700">
          Générez et exportez des rapports détaillés
        </p>
      </div>

      {/* Sélecteur de type */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
        onClick={() => setReportType('weekly')}
        className={`p-4 rounded-lg border-2 transition ${
          reportType === 'weekly'
            ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
            : 'border-gray-200 hover:border-indigo-300'
        }`}
      >
        <Calendar className="w-6 h-6 mx-auto mb-2" />
        <h3 className="font-semibold">Rapport Hebdomadaire</h3>
        <p className="text-xs mt-1 text-gray-600">7 derniers jours</p>
      </button>

      <button
        onClick={() => setReportType('monthly')}
        className={`p-4 rounded-lg border-2 transition ${
          reportType === 'monthly'
            ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
            : 'border-gray-200 hover:border-indigo-300'
        }`}
      >
        <Calendar className="w-6 h-6 mx-auto mb-2" />
        <h3 className="font-semibold">Rapport Mensuel</h3>
        <p className="text-xs mt-1 text-gray-600">Statistiques du mois</p>
      </button>
    </div>

    {/* Sélecteur de date */}
    <div className="flex flex-col sm:flex-row gap-4">
      {reportType === 'daily' && (
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {reportType === 'weekly' && (
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Semaine</label>
          <input
            type="week"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {reportType === 'monthly' && (
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Mois</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      <div className="flex gap-2 items-end">
        <button
          onClick={exportToExcel}
          disabled={reportData.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Excel
        </button>
        <button
          onClick={copyToClipboard}
          disabled={reportData.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          Copier
        </button>
      </div>
    </div>
  </div>

  {/* Tableau */}
  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
    {loading ? (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    ) : reportData.length === 0 ? (
      <div className="text-center py-12">
        <p className="text-gray-500">Aucune donnée pour cette période</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {reportType === 'daily' && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matricule</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Département</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arrivée</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Départ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heures</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">H. Sup.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </>
              )}
              {reportType === 'weekly' && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matricule</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours Présents</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Heures</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heures Sup.</th>
                </>
              )}
              {reportType === 'monthly' && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matricule</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Département</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">J. Ouvrables</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">J. Travaillés</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Présent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retards</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Absences</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total H</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">H. Sup.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taux %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reportType === 'daily' && reportData.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{r.matricule}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{r.employee_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{r.department}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{r.check_in}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{r.check_out}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{r.hours_worked}h</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">{r.overtime_hours || '0'}h</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    r.status === 'present' ? 'bg-green-100 text-green-800' :
                    r.status === 'late' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {r.status === 'present' ? 'Présent' : r.status === 'late' ? 'Retard' : 'Absent'}
                  </span>
                </td>
              </tr>
            ))}
            {reportType === 'weekly' && reportData.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{r.matricule}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{r.employee_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center">{r.days_present}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{r.total_hours.toFixed(2)}h</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">{r.total_overtime.toFixed(2)}h</td>
              </tr>
            ))}
            {reportType === 'monthly' && reportData.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{r.matricule}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{r.employee_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{r.department}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{r.working_days}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold">{r.days_worked}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-center">{r.days_present}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                  <span className="text-orange-600 font-semibold">{r.days_late}</span>
                  {r.late_minutes > 0 && (
                    <span className="text-xs text-gray-500 block">({Math.floor(r.late_minutes / 60)}h{r.late_minutes % 60}min)</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-center font-semibold">{r.days_absent}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{r.total_hours.toFixed(2)}h</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">{r.total_overtime.toFixed(2)}h</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    parseFloat(r.attendance_rate) >= 90 ? 'bg-green-100 text-green-800' :
                    parseFloat(r.attendance_rate) >= 75 ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {r.attendance_rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
</div>
) }