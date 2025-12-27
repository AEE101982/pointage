import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { Camera, QrCode as QrCodeIcon, Clock, User, X } from 'lucide-react'

export default function Scan() {
  const [manualCode, setManualCode] = useState('')
  const [result, setResult] = useState(null)
  const [todayAttendance, setTodayAttendance] = useState([])
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const scanIntervalRef = useRef(null)

  useEffect(() => {
    loadTodayAttendance()
    
    // Charger jsQR
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
    console.log('🎬 Démarrage caméra...')
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })
      
      console.log('✅ Stream obtenu')
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setScanning(true)
        
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              console.log('▶️ Vidéo en lecture')
              setTimeout(() => {
                scanIntervalRef.current = setInterval(scanQRCode, 500)
                console.log('🔍 Scan démarré')
              }, 500)
            }).catch(e => console.error('❌ Erreur play:', e))
          }
        }, 500)
      }
    } catch (error) {
      console.error('❌ Erreur caméra:', error)
      alert('Erreur caméra: ' + error.message)
    }
  }

  const stopCamera = () => {
    console.log('🛑 Arrêt caméra')
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
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

    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    const code = window.jsQR(imageData.data, imageData.width, imageData.height)

    if (code) {
      console.log('✅ QR trouvé:', code.data)
      stopCamera()
      handleScan(code.data)
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
        setResult({
          success: false,
          message: 'QR Code non reconnu'
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
          setResult({
            success: false,
            message: 'Déjà pointé',
            subtitle: `${employee.first_name} ${employee.last_name} a déjà pointé sa sortie`,
            employee
          })
        } else {
          const checkInParts = existing.check_in.split(':')
          const checkInMinutes = parseInt(checkInParts[0]) * 60 + parseInt(checkInParts[1])
          const checkOutMinutes = hour * 60 + minute
          const hoursWorked = (checkOutMinutes - checkInMinutes) / 60

          await supabase
            .from('attendance')
            .update({
              check_out: currentTime,
              hours_worked: hoursWorked.toFixed(2)
            })
            .eq('id', existing.id)

          setResult({
            success: true,
            type: 'checkout',
            message: 'Au revoir',
            employee,
            time: currentTime,
            hoursWorked: hoursWorked.toFixed(2)
          })
        }
      } else {
        let status = 'present'
        let statusMessage = '✅ À l\'heure'

        if (hour >= 8 && minute >= 35) {
          status = 'late'
          const lateMinutes = (hour - 8) * 60 + minute - 30
          statusMessage = '⚠️ Retard (+' + lateMinutes + ' min)'
        }

        await supabase
          .from('attendance')
          .insert({
            employee_id: employee.id,
            date: today,
            check_in: currentTime,
            status: status
          })

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
    } catch (err) {
      console.error('Erreur:', err)
      setResult({
        success: false,
        message: 'Erreur lors du pointage'
      })
    }
  }

  const handleManualScan = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim())
      setManualCode('')
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scanner QR Code</h1>
        <p className="mt-2 text-sm text-gray-700">Pointage des employés</p>
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
                <div className="space-y-2 bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-lg"><strong>Heure:</strong> {result.time}</p>
                  {result.statusMessage && <p className="text-lg">{result.statusMessage}</p>}
                  {result.hoursWorked && <p className="text-lg"><strong>Heures:</strong> {result.hoursWorked}h</p>}
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
                        className="flex-1 px-4 py-3 border rounded-lg font-mono"
                      />
                      <button
                        onClick={handleManualScan}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg"
                      >
                        OK
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={startCamera}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Scanner avec la caméra
                  </button>
                </>
              ) : (
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full"
                    playsInline
                    muted
                    autoPlay
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-white rounded-lg"></div>
                  </div>

                  <button
                    onClick={stopCamera}
                    className="absolute top-4 right-4 p-3 bg-red-600 text-white rounded-full"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  
                  <div className="absolute bottom-4 left-4 right-4 text-center">
                    <p className="text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded">
                      📷 Positionnez le QR code dans le cadre
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
              <p className="text-center text-gray-500 py-8">Aucun pointage</p>
            ) : (
              <div className="space-y-3">
                {todayAttendance.map((record) => (
                  <div key={record.id} className="flex justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">
                        {record.employees?.first_name} {record.employees?.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{record.employees?.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">↓ {record.check_in}</p>
                      {record.check_out && <p className="text-sm">↑ {record.check_out}</p>}
                      <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                        record.status === 'present' ? 'bg-green-100 text-green-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {record.status === 'present' ? 'Présent' : 'Retard'}
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
