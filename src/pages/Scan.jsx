import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { Camera, QrCode as QrCodeIcon, Clock, User, X } from 'lucide-react'

export default function Scan() {
  const [manualCode, setManualCode] = useState('')
  const [result, setResult] = useState(null)
  const [todayAttendance, setTodayAttendance] = useState([])
  const [scanning, setScanning] = useState(false)
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const scanIntervalRef = useRef(null)

  useEffect(() => {
    loadTodayAttendance()
    
    // Importer dynamiquement jsQR
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
    document.body.appendChild(script)

    return () => {
      stopCamera()
      document.body.removeChild(script)
    }
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

  const playSound = (type) => {
    const context = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)

    if (type === 'success') {
      oscillator.frequency.setValueAtTime(523.25, context.currentTime)
      oscillator.frequency.setValueAtTime(659.25, context.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(783.99, context.currentTime + 0.2)
      gainNode.gain.setValueAtTime(0.3, context.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5)
      oscillator.start(context.currentTime)
      oscillator.stop(context.currentTime + 0.5)
    } else {
      oscillator.frequency.setValueAtTime(400, context.currentTime)
      oscillator.frequency.setValueAtTime(300, context.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(200, context.currentTime + 0.2)
      gainNode.gain.setValueAtTime(0.3, context.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.4)
      oscillator.start(context.currentTime)
      oscillator.stop(context.currentTime + 0.4)
    }
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      
      setStream(mediaStream)
      setScanning(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
        
        // Démarrer le scan
        scanIntervalRef.current = setInterval(scanQRCode, 500)
      }
    } catch (error) {
      console.error('Erreur caméra:', error)
      alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
    }
  }

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    
    setScanning(false)
  }

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !window.jsQR) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = window.jsQR(imageData.data, imageData.width, imageData.height)

      if (code) {
        stopCamera()
        handleScan(code.data)
      }
    }
  }

  const handleScan = async (qrCode) => {
    try {
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('qr_code', qrCode)
        .single()

      if (empError || !employee) {
        playSound('error')
        setResult({
          success: false,
          message: 'QR Code non reconnu',
          employee: null
        })
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .single()

      const now = new Date()
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5)
      const hour = parseInt(currentTime.split(':')[0])
      const minute = parseInt(currentTime.split(':')[1])

      if (existing) {
        if (existing.check_out) {
          playSound('error')
          setResult({
            success: false,
            message: 'Déjà pointé',
            subtitle: `${employee.first_name} ${employee.last_name} a déjà pointé sa sortie aujourd'hui`,
            employee,
            time: existing.check_out
          })
        } else {
          const checkInParts = existing.check_in.split(':')
          const checkInHour = parseInt(checkInParts[0])
          const checkInMinute = parseInt(checkInParts[1])
          
          const checkInMinutes = checkInHour * 60 + checkInMinute
          const checkOutMinutes = hour * 60 + minute
          const workedMinutes = checkOutMinutes - checkInMinutes
          const hoursWorked = workedMinutes / 60

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

          playSound('success')
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
        let status = 'present'
        let statusMessage = '✅ À l\'heure'

        if (hour < 8 || (hour === 8 && minute < 35)) {
          status = 'present'
          statusMessage = '✅ À l\'heure'
        } else {
          status = 'late'
          if (hour === 8 && minute >= 35) {
            statusMessage = '⚠️ Retard (+' + (minute - 30) + ' min)'
          } else if (hour === 9) {
            statusMessage = '⚠️ Retard (+' + (30 + minute) + ' min)'
          } else if (hour >= 10) {
            const totalMinutes = (hour - 8) * 60 + minute - 30
            statusMessage = '⚠️ Retard important (+' + totalMinutes + ' min)'
          }
        }

        await supabase
          .from('attendance')
          .insert([{
            employee_id: employee.id,
            date: today,
            check_in: currentTime,
            status: status
          }])

        playSound('success')
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
      playSound('error')
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
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scanner QR Code</h1>
        <p className="mt-2 text-sm text-gray-700">
          Pointage des employés à l'arrivée et au départ
        </p>
      </div>

      {result ? (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
          result.success 
            ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
            : 'bg-gradient-to-br from-red-500 to-rose-600'
        }`}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
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
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="max-w-md mx-auto space-y-4">
              {!scanning ? (
                <>
                  {/* Saisie manuelle */}
                  <div className="border-2 border-dashed border-indigo-300 rounded-xl p-6 bg-indigo-50/50">
                    <div className="flex items-center justify-center mb-4">
                      <QrCodeIcon className="w-12 h-12 text-indigo-400" />
                    </div>
                    <p className="text-center text-sm text-gray-700 mb-4">
                      Saisissez le code employé
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                        placeholder="Code (ex: EMP0001)"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg font-mono"
                        autoFocus
                      />
                      <button
                        onClick={handleManualScan}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                      >
                        OK
                      </button>
                    </div>
                  </div>

                  {/* Bouton caméra */}
                  <button
                    onClick={startCamera}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Camera className="w-5 h-5" />
                    Scanner avec la caméra
                  </button>
                </>
              ) : (
                <>
                  {/* Vue caméra */}
                  <div className="relative">
                    <video
                      ref={videoRef}
                      className="w-full rounded-lg"
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Overlay de visée */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-64 h-64 border-4 border-white rounded-lg shadow-lg"></div>
                    </div>

                    {/* Bouton fermer */}
                    <button
                      onClick={stopCamera}
                      className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition shadow-lg"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <p className="text-center text-sm text-gray-600">
                    📷 Positionnez le QR code dans le cadre
                  </p>
                </>
              )}
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