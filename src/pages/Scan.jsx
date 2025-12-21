import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { Camera, QrCode as QrCodeIcon, Clock, User } from 'lucide-react'

export default function Scan() {
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [result, setResult] = useState(null)
  const [todayAttendance, setTodayAttendance] = useState([])
  const [cameraError, setCameraError] = useState(false)

  useEffect(() => {
    loadTodayAttendance()
  }, [])

  const loadTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('attendance')
        .select('*, employees(first_name, last_name, department)')
        .eq('date', today)
        .order('created_at', { ascending: false })

      setTodayAttendance(data || [])
    } catch (error) {
      console.error('Erreur chargement présences:', error)
    }
  }

  const handleScan = async (qrCode) => {
    try {
      // Trouver l'employé
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('qr_code', qrCode)
        .single()

      if (empError || !employee) {
        setResult({
          success: false,
          message: 'QR Code non reconnu',
          employee: null
        })
        return
      }

      // Vérifier si déjà pointé aujourd'hui
      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .single()

      const now = new Date()
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5) // HH:MM
      const hour = parseInt(currentTime.split(':')[0])
      const minute = parseInt(currentTime.split(':')[1])

      if (existing) {
        // Déjà pointé - enregistrer l'heure de sortie
        if (existing.check_out) {
          setResult({
            success: false,
            message: 'Déjà pointé',
            subtitle: `${employee.first_name} ${employee.last_name} a déjà pointé sa sortie aujourd'hui`,
            employee,
            time: existing.check_out
          })
        } else {
          // Calculer les heures travaillées
          const checkInParts = existing.check_in.split(':')
          const checkInHour = parseInt(checkInParts[0])
          const checkInMinute = parseInt(checkInParts[1])
          
          const checkInMinutes = checkInHour * 60 + checkInMinute
          const checkOutMinutes = hour * 60 + minute
          const workedMinutes = checkOutMinutes - checkInMinutes
          const hoursWorked = workedMinutes / 60

          // Calculer les heures supplémentaires (après 18h)
          let overtimeHours = 0
          if (hour >= 18) {
            const overtimeMinutes = checkOutMinutes - (18 * 60)
            overtimeHours = overtimeMinutes / 60
          }

          await supabase
            .from('attendance')
            .update({
              check_out: currentTime,
              hours_worked: hoursWorked.toFixed(2),
              overtime_hours: overtimeHours > 0 ? overtimeHours.toFixed(2) : '0'
            })
            .eq('id', existing.id)

          setResult({
            success: true,
            type: 'checkout',
            message: `Au revoir`,
            employee,
            time: currentTime,
            hoursWorked: hoursWorked.toFixed(2)
          })
        }
      } else {
        // Première pointage - Déterminer le statut
        let status = 'present'
        let statusMessage = '✅ À l\'heure'

        // Logique de statut basée sur l'heure d'arrivée
        if (hour < 8 || (hour === 8 && minute < 30)) {
          // Arrivée avant 8h30 (trop tôt mais présent)
          status = 'present'
          statusMessage = '✅ En avance'
        } else if ((hour === 8 && minute >= 30) || (hour === 9 && minute === 0)) {
          // Entre 8h30 et 9h00 : À l'heure
          status = 'present'
          statusMessage = '✅ À l\'heure'
        } else if (hour === 9 && minute > 0 && minute <= 15) {
          // Entre 9h01 et 9h15 : Léger retard (tolérance)
          status = 'late'
          statusMessage = '⏰ Retard (tolérance)'
        } else if (hour === 9 && minute > 15) {
          // Après 9h15 dans la même heure
          status = 'late'
          statusMessage = '⚠️ Retard'
        } else if (hour >= 10) {
          // Arrivée après 10h : Retard important
          status = 'late'
          statusMessage = '⚠️ Retard important'
        }

        await supabase
          .from('attendance')
          .insert([{
            employee_id: employee.id,
            date: today,
            check_in: currentTime,
            status: status
          }])

        const greeting = hour < 12 ? 'Bonjour' : 'Bon après-midi'

        setResult({
          success: true,
          type: 'checkin',
          message: greeting,
          employee,
          time: currentTime,
          status,
          statusMessage
        })
      }

      loadTodayAttendance()
    } catch (error) {
      console.error('Erreur pointage:', error)
      setResult({
        success: false,
        message: 'Erreur lors du pointage',
        employee: null
      })
    }
  }

  const handleManualScan = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim())
      setManualCode('')
    }
  }

  const resetScan = () => {
    setResult(null)
    setCameraError(false)
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scanner QR Code</h1>
        <p className="mt-2 text-sm text-gray-700">
          Pointage des employés à l'arrivée et au départ
        </p>
      </div>

      {/* ✅ ÉCRAN DE CONFIRMATION PLEIN ÉCRAN */}
      {result ? (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
          result.success 
            ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
            : 'bg-gradient-to-br from-red-500 to-rose-600'
        }`}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Photo de profil */}
            {result.employee && (
              <div className="relative h-64 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                {result.employee.photo_url ? (
                  <img 
                    src={result.employee.photo_url} 
                    alt={`${result.employee.first_name} ${result.employee.last_name}`}
                    className="w-48 h-48 rounded-full object-cover border-8 border-white shadow-xl"
                  />
                ) : (
                  <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-8 border-white shadow-xl flex items-center justify-center">
                    <User className="w-24 h-24 text-white" />
                  </div>
                )}
              </div>
            )}

            {/* Contenu */}
            <div className="p-8">
              {result.success ? (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      {result.message}
                    </h2>
                    {result.employee && (
                      <p className="text-2xl font-semibold text-indigo-600">
                        {result.employee.first_name} {result.employee.last_name}
                      </p>
                    )}
                  </div>

                  {/* Informations */}
                  <div className="space-y-4 bg-gray-50 rounded-2xl p-6">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Heure</span>
                      <span className="text-2xl font-bold text-gray-900">{result.time}</span>
                    </div>

                    {result.type === 'checkin' && result.statusMessage && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Statut</span>
                        <span className={`px-4 py-2 rounded-full font-semibold ${
                          result.status === 'present' ? 'bg-green-100 text-green-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {result.statusMessage}
                        </span>
                      </div>
                    )}

                    {result.type === 'checkout' && result.hoursWorked && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Heures travaillées</span>
                        <span className="text-xl font-bold text-indigo-600">
                          {result.hoursWorked}h
                        </span>
                      </div>
                    )}

                    {result.employee && (
                      <>
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">Département</span>
                          <span className="font-semibold text-gray-900">
                            {result.employee.department}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Matricule</span>
                          <span className="font-mono text-gray-900">
                            {result.employee.matricule}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">❌</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {result.message}
                  </h2>
                  {result.subtitle && (
                    <p className="text-gray-600">{result.subtitle}</p>
                  )}
                </div>
              )}

              {/* Bouton OK */}
              <button
                onClick={resetScan}
                className={`w-full mt-6 py-4 rounded-xl font-bold text-white shadow-lg transition transform hover:scale-105 ${
                  result.success 
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
                    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                }`}
              >
                OK - Scanner un autre
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Zone de scan */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="max-w-md mx-auto space-y-4">
              {/* Saisie manuelle */}
              <div className="border-2 border-dashed border-indigo-300 rounded-xl p-6 bg-indigo-50/50">
                <div className="flex items-center justify-center mb-4">
                  <QrCodeIcon className="w-12 h-12 text-indigo-400" />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                    placeholder="Code QR (ex: EMP0001)"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleManualScan}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                  >
                    OK
                  </button>
                </div>
              </div>

              {cameraError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  ⚠️ Impossible d'accéder à la caméra. Utilisez la saisie manuelle ci-dessus.
                </div>
              )}

              <p className="text-xs text-center text-gray-500">
                💡 Astuce : Vous pouvez aussi utiliser un lecteur de code-barres externe
              </p>
            </div>
          </div>

          {/* Présents aujourd'hui */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Présents aujourd'hui ({todayAttendance.length})
              </h2>
            </div>

            {todayAttendance.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun pointage aujourd'hui</p>
            ) : (
              <div className="space-y-3">
                {todayAttendance.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {record.employees?.first_name} {record.employees?.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{record.employees?.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">↓ {record.check_in}</p>
                      {record.check_out && (
                        <p className="text-sm text-gray-600">↑ {record.check_out}</p>
                      )}
                      <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${
                        record.status === 'present' ? 'bg-green-100 text-green-800' :
                        record.status === 'late' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.status === 'present' ? 'Présent' :
                         record.status === 'late' ? 'Retard' : 'Absent'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}