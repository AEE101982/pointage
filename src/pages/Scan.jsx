import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { Camera, QrCode as QrCodeIcon, Clock, User, X, AlertTriangle } from 'lucide-react'

export default function Scan() {
  const [manualCode, setManualCode] = useState('')
  const [result, setResult] = useState(null)
  const [todayAttendance, setTodayAttendance] = useState([])
  const [scanning, setScanning] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const scanIntervalRef = useRef(null)

  useEffect(() => {
    loadTodayAttendance()
    
    if (!window.jsQR) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
      document.body.appendChild(script)
    }
    
    return () => {
      stopCamera()
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
      console.error('Erreur:', error)
    }
  }

  const startCamera = async () => {
    setErrorMessage('')
    setScanning(true)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia non supporté')
      }

      if (!videoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 200))
        
        if (!videoRef.current) {
          throw new Error('Impossible de monter l\'élément vidéo')
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })

      videoRef.current.srcObject = stream
      
      await new Promise(resolve => setTimeout(resolve, 300))
      
      try {
        await videoRef.current.play()
      } catch (playErr) {
        await new Promise(resolve => setTimeout(resolve, 500))
        await videoRef.current.play()
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      if (videoRef.current.videoWidth === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      if (videoRef.current.videoWidth > 0) {
        scanIntervalRef.current = setInterval(scanQRCode, 300)
      } else {
        throw new Error('Impossible d\'obtenir les dimensions de la vidéo')
      }
      
    } catch (error) {
      console.error('Erreur caméra:', error)
      
      let userMsg = 'Impossible d\'accéder à la caméra'
      
      if (error.name === 'NotAllowedError') {
        userMsg = 'Permission caméra refusée.\n\nAllez dans Paramètres > Safari/Chrome > Appareil photo et autorisez l\'accès pour ce site.'
      } else if (error.name === 'NotFoundError') {
        userMsg = 'Aucune caméra trouvée sur cet appareil.'
      } else if (error.name === 'NotReadableError') {
        userMsg = 'La caméra est déjà utilisée par une autre application.\n\nFermez les autres applications et réessayez.'
      } else if (error.name === 'OverconstrainedError') {
        userMsg = 'Caméra arrière non disponible.'
      }
      
      setErrorMessage(userMsg)
      setScanning(false)
    }
  }

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    
    setScanning(false)
  }

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !window.jsQR) return

    const video = videoRef.current
    const canvas = canvasRef.current

    if (video.readyState < 2) return
    if (video.videoWidth === 0) return

    try {
      const ctx = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      const code = window.jsQR(imageData.data, imageData.width, imageData.height)

      if (code) {
        stopCamera()
        handleScan(code.data)
      }
    } catch (err) {
      console.error('Erreur scan:', err)
    }
  }

  const calculateStatus = (hour, minute) => {
    // Horaires de travail : 8h30-13h00 et 14h00-18h00
    
    // Matin : avant 8h35 = à l'heure, après = retard
    if (hour < 8 || (hour === 8 && minute <= 35)) {
      return { status: 'present', message: '✅ À l\'heure' }
    }
    
    if (hour === 8 && minute > 35) {
      const lateMinutes = minute - 30
      return { status: 'late', message: `⚠️ Retard (+${lateMinutes} min)` }
    }
    
    if (hour >= 9) {
      const lateMinutes = (hour - 8) * 60 + minute - 30
      return { status: 'late', message: `⚠️ Retard (+${lateMinutes} min)` }
    }
    
    return { status: 'present', message: '✅ À l\'heure' }
  }

  const calculateHours = (checkInMorning, checkOutMorning, checkInAfternoon, checkOutAfternoon) => {
    let totalMinutes = 0
    let overtimeMinutes = 0
    
    // Heures du matin (8h30 - 13h00)
    if (checkInMorning && checkOutMorning) {
      const [inH, inM] = checkInMorning.split(':').map(Number)
      const [outH, outM] = checkOutMorning.split(':').map(Number)
      totalMinutes += (outH * 60 + outM) - (inH * 60 + inM)
    }
    
    // Heures de l'après-midi (14h00 - 18h00)
    if (checkInAfternoon && checkOutAfternoon) {
      const [inH, inM] = checkInAfternoon.split(':').map(Number)
      const [outH, outM] = checkOutAfternoon.split(':').map(Number)
      const afternoonMinutes = (outH * 60 + outM) - (inH * 60 + inM)
      totalMinutes += afternoonMinutes
      
      // Calcul des heures supplémentaires après 18h15
      if (outH > 18 || (outH === 18 && outM > 15)) {
        const overtimeStart = 18 * 60 + 15 // 18h15 en minutes
        const checkOutMinutes = outH * 60 + outM
        overtimeMinutes = checkOutMinutes - overtimeStart
      }
    }
    
    return {
      totalHours: (totalMinutes / 60).toFixed(2),
      overtimeHours: (overtimeMinutes / 60).toFixed(2)
    }
  }

  const handleScan = async (qrCode) => {
    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('qr_code', qrCode)
        .single()

      if (!employee) {
        setResult({ success: false, message: 'QR Code non reconnu' })
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

      // Déterminer le type de pointage en fonction de l'heure
      let pointageType = ''
      let greeting = ''
      
      if (hour < 13) {
        // Matin (avant 13h)
        if (!existing) {
          // Premier pointage : entrée matin
          const statusInfo = calculateStatus(hour, minute)
          
          await supabase
            .from('attendance')
            .insert({
              employee_id: employee.id,
              date: today,
              check_in_morning: currentTime,
              status: statusInfo.status
            })

          pointageType = 'Entrée matin'
          greeting = 'Bonjour'
          
          setResult({
            success: true,
            type: 'check_in_morning',
            message: greeting,
            employee,
            time: currentTime,
            pointageType,
            status: statusInfo.status,
            statusMessage: statusInfo.message
          })
        } else if (!existing.check_out_morning) {
          // Deuxième pointage : sortie matin
          await supabase
            .from('attendance')
            .update({ check_out_morning: currentTime })
            .eq('id', existing.id)

          pointageType = 'Sortie pause déjeuner'
          
          setResult({
            success: true,
            type: 'check_out_morning',
            message: 'Bonne pause déjeuner',
            employee,
            time: currentTime,
            pointageType
          })
        } else {
          setResult({
            success: false,
            message: 'Sortie matin déjà enregistrée',
            subtitle: 'Revenez à 14h pour pointer votre retour',
            employee
          })
        }
      } else {
        // Après-midi (après 13h)
        if (!existing) {
          setResult({
            success: false,
            message: 'Aucun pointage ce matin',
            subtitle: 'Vous devez d\'abord pointer votre arrivée du matin',
            employee
          })
        } else if (!existing.check_in_afternoon) {
          // Troisième pointage : retour après-midi
          await supabase
            .from('attendance')
            .update({ check_in_afternoon: currentTime })
            .eq('id', existing.id)

          pointageType = 'Retour après-midi'
          
          setResult({
            success: true,
            type: 'check_in_afternoon',
            message: 'Bon après-midi',
            employee,
            time: currentTime,
            pointageType
          })
        } else if (!existing.check_out_afternoon) {
          // Quatrième pointage : sortie après-midi
          const { totalHours, overtimeHours } = calculateHours(
            existing.check_in_morning,
            existing.check_out_morning,
            existing.check_in_afternoon,
            currentTime
          )

          await supabase
            .from('attendance')
            .update({
              check_out_afternoon: currentTime,
              hours_worked: totalHours,
              overtime_hours: overtimeHours
            })
            .eq('id', existing.id)

          pointageType = 'Sortie fin de journée'
          
          setResult({
            success: true,
            type: 'check_out_afternoon',
            message: 'À demain',
            employee,
            time: currentTime,
            pointageType,
            hoursWorked: totalHours,
            overtimeHours: overtimeHours
          })
        } else {
          setResult({
            success: false,
            message: 'Journée complète',
            subtitle: `${employee.first_name} ${employee.last_name} a déjà pointé tous les passages aujourd'hui`,
            employee
          })
        }
      }

      loadTodayAttendance()
    } catch (err) {
      console.error('Erreur:', err)
      setResult({ success: false, message: 'Erreur lors du pointage' })
    }
  }

  const handleManualScan = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim())
      setManualCode('')
    }
  }

  const getAttendanceStatus = (record) => {
    if (record.check_out_afternoon) {
      return { text: 'Journée complète', color: 'bg-green-100 text-green-800' }
    }
    if (record.check_in_afternoon) {
      return { text: 'Après-midi en cours', color: 'bg-blue-100 text-blue-800' }
    }
    if (record.check_out_morning) {
      return { text: 'Pause déjeuner', color: 'bg-yellow-100 text-yellow-800' }
    }
    if (record.check_in_morning) {
      return { text: 'Matin en cours', color: 'bg-blue-100 text-blue-800' }
    }
    return { text: 'Absent', color: 'bg-red-100 text-red-800' }
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scanner QR Code</h1>
        <p className="mt-2 text-sm text-gray-700">
          Horaires : 8h30-13h00 / 14h00-18h00
        </p>
      </div>

      {result ? (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
          result.success ? 'bg-green-500' : 'bg-red-500'
        }`}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            {result.employee && (
              <div className="flex justify-center mb-6">
                {result.employee.photo_url ? (
                  <img 
                    src={result.employee.photo_url} 
                    alt={result.employee.first_name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-xl"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-indigo-600 flex items-center justify-center">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
              </div>
            )}

            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{result.message}</h2>
              {result.employee && (
                <p className="text-2xl font-semibold text-indigo-600 mb-4">
                  {result.employee.first_name} {result.employee.last_name}
                </p>
              )}

              {result.success && (
                <div className="space-y-3 bg-gray-50 rounded-xl p-4 mb-6">
                  {result.pointageType && (
                    <p className="text-lg font-semibold text-purple-600">{result.pointageType}</p>
                  )}
                  <p className="text-lg"><strong>Heure:</strong> {result.time}</p>
                  {result.statusMessage && <p className="text-lg">{result.statusMessage}</p>}
                  {result.hoursWorked && (
                    <p className="text-lg">
                      <strong>Heures travaillées:</strong> {result.hoursWorked}h
                    </p>
                  )}
                  {result.overtimeHours && parseFloat(result.overtimeHours) > 0 && (
                    <p className="text-lg font-bold text-orange-600">
                      ⏰ Heures sup: {result.overtimeHours}h
                    </p>
                  )}
                </div>
              )}

              {result.subtitle && (
                <p className="text-gray-600 mb-6">{result.subtitle}</p>
              )}
            </div>

            <button
              onClick={() => setResult(null)}
              className={`w-full py-4 rounded-xl font-bold text-white ${
                result.success ? 'bg-green-600' : 'bg-red-600'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="max-w-md mx-auto space-y-4">
              {!scanning ? (
                <>
                  <div className="border-2 border-dashed border-indigo-300 rounded-xl p-6 bg-indigo-50">
                    <div className="flex items-center justify-center mb-4">
                      <QrCodeIcon className="w-12 h-12 text-indigo-400" />
                    </div>
                    <p className="text-center text-sm text-gray-700 mb-4">Code employé</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                        placeholder="EMP0001"
                        className="flex-1 px-4 py-3 border rounded-lg font-mono text-lg"
                      />
                      <button
                        onClick={handleManualScan}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold"
                      >
                        OK
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={startCamera}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Camera className="w-5 h-5" />
                    Scanner avec la caméra
                  </button>

                  {errorMessage && (
                    <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <p className="font-bold text-red-900 mb-2">Erreur Caméra</p>
                          <p className="text-sm text-red-700 whitespace-pre-line">{errorMessage}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full"
                    style={{ minHeight: '400px', maxHeight: '70vh' }}
                    playsInline
                    muted
                    autoPlay
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-white rounded-lg shadow-2xl"></div>
                  </div>

                  <button
                    onClick={stopCamera}
                    className="absolute top-4 right-4 p-3 bg-red-600 text-white rounded-full shadow-lg z-10"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  
                  <div className="absolute bottom-4 left-0 right-0 px-4">
                    <p className="text-center text-white text-sm bg-black bg-opacity-60 px-4 py-2 rounded-lg">
                      📷 Positionnez le QR code dans le cadre blanc
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold">Présents aujourd'hui ({todayAttendance.length})</h2>
            </div>

            {todayAttendance.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun pointage aujourd'hui</p>
            ) : (
              <div className="space-y-3">
                {todayAttendance.map((record) => {
                  const attendanceStatus = getAttendanceStatus(record)
                  return (
                    <div key={record.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {record.employees?.first_name} {record.employees?.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{record.employees?.department}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${attendanceStatus.color}`}>
                          {attendanceStatus.text}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-2">
                        {record.check_in_morning && (
                          <div>↓ Matin: {record.check_in_morning}</div>
                        )}
                        {record.check_out_morning && (
                          <div>↑ Pause: {record.check_out_morning}</div>
                        )}
                        {record.check_in_afternoon && (
                          <div>↓ Retour: {record.check_in_afternoon}</div>
                        )}
                        {record.check_out_afternoon && (
                          <div>↑ Sortie: {record.check_out_afternoon}</div>
                        )}
                      </div>
                      {record.hours_worked && (
                        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm">
                          <span className="font-medium">Total: {record.hours_worked}h</span>
                          {parseFloat(record.overtime_hours) > 0 && (
                            <span className="text-orange-600 font-medium">
                              HS: {record.overtime_hours}h
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
