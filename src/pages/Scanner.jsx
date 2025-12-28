import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { QrCode, Camera, CheckCircle, XCircle, Clock } from 'lucide-react'

export default function Scanner({ user }) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [recentScans, setRecentScans] = useState([])

  useEffect(() => {
    loadRecentScans()
  }, [])

  const loadRecentScans = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          employees (
            matricule,
            first_name,
            last_name,
            department
          )
        `)
        .gte('check_in', `${today}T00:00:00`)
        .order('check_in', { ascending: false })
        .limit(10)

      if (error) throw error
      
      setRecentScans(data || [])
    } catch (error) {
      console.error('Erreur chargement scans:', error)
    }
  }

  const handleScan = async (qrData) => {
    setError('')
    setResult(null)

    try {
      // Simuler le scan (dans la vraie app, utiliser une lib QR)
      // Format attendu du QR : "EMPLOYEE:matricule" ou juste "matricule"
      const matricule = qrData.replace('EMPLOYEE:', '').trim()

      // Trouver l'employé
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('matricule', matricule)
        .single()

      if (empError || !employee) {
        throw new Error('Employé non trouvé')
      }

      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const currentTime = now.toTimeString().split(' ')[0]

      // Vérifier s'il y a déjà un pointage aujourd'hui
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('check_in', `${today}T00:00:00`)
        .lte('check_in', `${today}T23:59:59`)
        .single()

      if (existing && !existing.check_out) {
        // Pointage de sortie
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            check_out: `${today}T${currentTime}`,
            status: 'completed'
          })
          .eq('id', existing.id)

        if (updateError) throw updateError

        setResult({
          type: 'checkout',
          employee: employee,
          time: currentTime
        })
      } else if (existing && existing.check_out) {
        throw new Error('Pointage déjà effectué aujourd\'hui')
      } else {
        // Pointage d'entrée
        const { error: insertError } = await supabase
          .from('attendance')
          .insert([{
            employee_id: employee.id,
            check_in: `${today}T${currentTime}`,
            date: today,
            status: 'present'
          }])

        if (insertError) throw insertError

        setResult({
          type: 'checkin',
          employee: employee,
          time: currentTime
        })
      }

      await loadRecentScans()

    } catch (error) {
      console.error('Erreur scan:', error)
      setError(error.message)
    }
  }

  const handleManualEntry = () => {
    const matricule = prompt('Entrez le matricule de l\'employé :')
    if (matricule) {
      handleScan(matricule)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scanner QR Code</h1>
        <p className="mt-2 text-sm text-gray-700">
          Scanner le QR code des employés pour enregistrer les présences
        </p>
      </div>

      {/* Zone de scan */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="max-w-md mx-auto">
          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-6 border-4 border-dashed border-gray-300">
            {scanning ? (
              <div className="text-center">
                <Camera className="w-24 h-24 text-indigo-600 mx-auto mb-4 animate-pulse" />
                <p className="text-gray-600">Caméra active...</p>
                <p className="text-sm text-gray-500 mt-2">Placez le QR code devant la caméra</p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="w-24 h-24 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Prêt à scanner</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setScanning(!scanning)}
              className={`w-full py-3 rounded-lg font-semibold transition ${
                scanning
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {scanning ? 'Arrêter le scan' : 'Démarrer le scan'}
            </button>

            <button
              onClick={handleManualEntry}
              className="w-full py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition"
            >
              Saisie manuelle du matricule
            </button>
          </div>
        </div>
      </div>

      {/* Résultat du scan */}
      {result && (
        <div className={`rounded-xl shadow-lg p-6 ${
          result.type === 'checkin' ? 'bg-green-50 border-2 border-green-200' : 'bg-blue-50 border-2 border-blue-200'
        }`}>
          <div className="flex items-center gap-4">
            {result.type === 'checkin' ? (
              <CheckCircle className="w-12 h-12 text-green-600" />
            ) : (
              <Clock className="w-12 h-12 text-blue-600" />
            )}
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {result.type === 'checkin' ? 'Entrée enregistrée' : 'Sortie enregistrée'}
              </h3>
              <p className="text-gray-700">
                {result.employee.first_name} {result.employee.last_name} ({result.employee.matricule})
              </p>
              <p className="text-sm text-gray-600">
                {result.type === 'checkin' ? 'Arrivée' : 'Départ'} : {result.time}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <XCircle className="w-12 h-12 text-red-600" />
            <div>
              <h3 className="text-xl font-bold text-red-900">Erreur</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scans récents */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Scans récents (aujourd'hui)</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {recentScans.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <QrCode className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              Aucun scan aujourd'hui
            </div>
          ) : (
            recentScans.map((scan) => (
              <div key={scan.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      scan.check_out ? 'bg-blue-500' : 'bg-green-500'
                    }`}></div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {scan.employees?.first_name} {scan.employees?.last_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {scan.employees?.matricule} - {scan.employees?.department}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      Entrée: {scan.check_in ? new Date(scan.check_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </div>
                    {scan.check_out && (
                      <div className="text-sm text-gray-600">
                        Sortie: {new Date(scan.check_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <QrCode className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Comment utiliser le scanner :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Cliquez sur "Démarrer le scan" pour activer la caméra</li>
              <li>Placez le QR code de l'employé devant la caméra</li>
              <li>Le système enregistre automatiquement l'entrée ou la sortie</li>
              <li>Vous pouvez aussi utiliser la saisie manuelle du matricule</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
