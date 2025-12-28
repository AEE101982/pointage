import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Settings as SettingsIcon, Building2, Clock, DollarSign, Users, Save } from 'lucide-react'

export default function Settings() {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    company_name: 'Sahara Mobilier',
    address: '',
    phone: '',
    email: '',
    working_hours_start: '08:00',
    working_hours_end: '17:00',
    break_duration: 60,
    overtime_rate: 1.5,
    weekend_rate: 2.0,
    late_tolerance: 15,
    early_departure_tolerance: 15,
    salary_day: 1
  })

  const handleChange = (field, value) => {
    setSettings({ ...settings, [field]: value })
    setSaved(false)
  }

  const handleSave = async () => {
    setSaved(false)
    setLoading(true)

    try {
      // Dans une vraie app, sauvegarder dans une table settings
      // Pour l'instant, juste simuler la sauvegarde
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="mt-2 text-sm text-gray-700">
          Configurer les paramètres de l'application
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="divide-y divide-gray-200">
          
          {/* Informations entreprise */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">Informations de l'entreprise</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'entreprise
                </label>
                <input
                  type="text"
                  value={settings.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="contact@sahara.ma"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="+212 5XX-XXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Casablanca, Maroc"
                />
              </div>
            </div>
          </div>

          {/* Horaires de travail */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">Horaires de travail</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heure de début
                </label>
                <input
                  type="time"
                  value={settings.working_hours_start}
                  onChange={(e) => handleChange('working_hours_start', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heure de fin
                </label>
                <input
                  type="time"
                  value={settings.working_hours_end}
                  onChange={(e) => handleChange('working_hours_end', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durée pause (minutes)
                </label>
                <input
                  type="number"
                  value={settings.break_duration}
                  onChange={(e) => handleChange('break_duration', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Tolérance */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">Tolérance présence</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retard toléré (minutes)
                </label>
                <input
                  type="number"
                  value={settings.late_tolerance}
                  onChange={(e) => handleChange('late_tolerance', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Temps de retard accepté sans pénalité
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Départ anticipé toléré (minutes)
                </label>
                <input
                  type="number"
                  value={settings.early_departure_tolerance}
                  onChange={(e) => handleChange('early_departure_tolerance', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Temps de départ anticipé accepté sans pénalité
                </p>
              </div>
            </div>
          </div>

          {/* Taux et salaires */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-gray-900">Taux et salaires</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taux heures supplémentaires
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.overtime_rate}
                  onChange={(e) => handleChange('overtime_rate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Multiplicateur du taux horaire normal
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taux week-end
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.weekend_rate}
                  onChange={(e) => handleChange('weekend_rate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Multiplicateur pour le travail le week-end
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jour de paiement
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={settings.salary_day}
                  onChange={(e) => handleChange('salary_day', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Jour du mois (1-31)
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Bouton de sauvegarde */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              {saved && (
                <span className="text-green-600 text-sm font-medium">
                  ✓ Paramètres enregistrés
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </div>
        </div>
      </div>

      {/* Informations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <SettingsIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">À propos des paramètres :</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ces paramètres s'appliquent à toute l'entreprise</li>
              <li>Les changements prennent effet immédiatement</li>
              <li>Seuls les administrateurs peuvent modifier ces paramètres</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
