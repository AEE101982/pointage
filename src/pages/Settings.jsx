import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { DollarSign, Save, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { role } = useAuth()
  const [hourlyRate, setHourlyRate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('overtime_settings')
        .select('hourly_rate')
        .single()

      if (error) throw error

      if (data) {
        setHourlyRate(data.hourly_rate.toString())
      }
    } catch (error) {
      console.error('Erreur chargement paramètres:', error)
      setMessage({ type: 'error', text: 'Erreur lors du chargement des paramètres' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!hourlyRate || parseFloat(hourlyRate) < 0) {
      setMessage({ type: 'error', text: 'Veuillez entrer un tarif valide' })
      return
    }

    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await supabase
        .from('overtime_settings')
        .update({ 
          hourly_rate: parseFloat(hourlyRate),
          updated_at: new Date().toISOString()
        })
        .eq('id', (await supabase.from('overtime_settings').select('id').single()).data.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Tarif enregistré avec succès !' })
      
      setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 3000)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  // Vérifier si l'utilisateur est admin
  if (role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Accès refusé</h3>
              <p className="text-sm text-red-700">Seuls les administrateurs peuvent accéder aux paramètres.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="mt-2 text-sm text-gray-700">Configuration du système de pointage</p>
      </div>

      {/* Tarif heures supplémentaires */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <DollarSign className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Heures supplémentaires</h2>
            <p className="text-sm text-gray-600">Tarif horaire après 18h15</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tarif horaire (MAD)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                placeholder="50.00"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Ce tarif sera appliqué pour calculer le montant des heures supplémentaires
            </p>
          </div>

          {/* Message de retour */}
          {message.text && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <p className={`text-sm font-medium ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message.text}
              </p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>

      {/* Informations sur les horaires */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3">📅 Horaires de travail</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <div className="flex justify-between">
            <span>Matin :</span>
            <span className="font-mono font-semibold">08h30 - 13h00</span>
          </div>
          <div className="flex justify-between">
            <span>Après-midi :</span>
            <span className="font-mono font-semibold">14h00 - 18h00</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-blue-200">
            <span>Heures supplémentaires :</span>
            <span className="font-mono font-semibold">À partir de 18h15</span>
          </div>
        </div>
      </div>

      {/* Exemple de calcul */}
      {hourlyRate && parseFloat(hourlyRate) > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-3">💡 Exemple de calcul</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>Un employé qui termine à <strong>19h00</strong> :</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Heures normales : 8h00 (08h30-13h00 + 14h00-18h00)</li>
              <li>Heures supplémentaires : 0.75h (18h15-19h00)</li>
              <li className="font-semibold text-indigo-600">
                Montant HS : {(parseFloat(hourlyRate) * 0.75).toFixed(2)} MAD
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
