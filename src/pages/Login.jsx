import { useState } from 'react'
import { supabase } from '../services/supabase'
import { Lock, Mail } from 'lucide-react'

// Import conditionnel du logo
let saharaLogo
try {
  saharaLogo = new URL('../assets/sahara-logo.png', import.meta.url).href
} catch (e) {
  saharaLogo = null
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw authError

      if (data.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (userError || !userData) {
          throw new Error('Utilisateur non autorisé')
        }

        onLogin(userData)
      }
    } catch (err) {
      console.error('Erreur login:', err)
      setError(err.message === 'Invalid login credentials' 
        ? 'Email ou mot de passe incorrect' 
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-800 via-red-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo Sahara Mobilier */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            {saharaLogo ? (
              // Si le logo existe, l'afficher
              <img 
                src={saharaLogo} 
                alt="Logo Sahara Mobilier"
                className="w-32 h-32 rounded-full shadow-lg object-contain bg-white p-2"
              />
            ) : (
              // Sinon, afficher un logo par défaut avec initiales
              <div className="w-32 h-32 rounded-full shadow-lg bg-gradient-to-br from-red-800 to-red-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">SM</div>
                  <div className="text-xs text-red-100 mt-1">USINE</div>
                </div>
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Système de Gestion RH
          </h1>
          <p className="text-gray-600 text-lg">
            Usine Sahara
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm text-center">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:border-transparent"
                placeholder="utilisateur@sahara.ma"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-800 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-800 to-red-900 text-white py-3 rounded-lg font-semibold hover:from-red-900 hover:to-gray-900 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          © 2025 Sahara Mobilier
        </div>
      </div>
    </div>
  )
}
