import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { UserCog, Trash2, Shield, User, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function Users() {
  const { user: currentUser, role: currentRole } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'hr'
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async () => {
    setError('')

    // Validation
    if (!formData.email || !formData.password) {
      setError('Veuillez remplir tous les champs')
      return
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    try {
      // 1. Créer l'utilisateur dans Auth (via l'API admin)
      // Note: En production, cette opération devrait être faite via une fonction serveur
      // Pour l'instant, on va juste créer l'entrée dans la table users
      
      // Vérifier si l'email existe déjà
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', formData.email)
        .single()

      if (existingUser) {
        setError('Cet email existe déjà')
        return
      }

      // 2. Créer l'entrée dans la table users
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          email: formData.email,
          role: formData.role
        }])

      if (insertError) throw insertError

      alert(`✅ Utilisateur créé avec succès !

📧 Email : ${formData.email}
🔑 Mot de passe : ${formData.password}
👤 Rôle : ${formData.role === 'admin' ? 'Administrateur' : 'Responsable RH'}

⚠️ IMPORTANT : L'utilisateur doit être créé manuellement dans Supabase Auth avec ces identifiants.

Instructions :
1. Allez dans Supabase Dashboard
2. Authentication → Users → Add user
3. Email : ${formData.email}
4. Mot de passe : ${formData.password}
5. Confirmez`)

      setShowModal(false)
      setFormData({ email: '', password: '', role: 'hr' })
      loadUsers()
    } catch (error) {
      console.error('Erreur création utilisateur:', error)
      setError('Erreur lors de la création : ' + error.message)
    }
  }

  const handleDeleteUser = async (email, userId) => {
    if (email === currentUser?.email) {
      alert('Vous ne pouvez pas supprimer votre propre compte')
      return
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${email} ?`)) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('email', email)

      if (error) throw error

      alert(`✅ Utilisateur supprimé de la base de données !

⚠️ N'oubliez pas de le supprimer aussi dans Supabase Auth :
1. Allez dans Supabase Dashboard
2. Authentication → Users
3. Trouvez ${email}
4. Supprimez-le`)

      loadUsers()
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }

  // Vérifier que l'utilisateur est admin
  if (currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h2>
          <p className="text-gray-600">Vous devez être administrateur pour accéder à cette page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="mt-2 text-sm text-gray-700">
            {users.length} utilisateur{users.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
        >
          <UserCog className="w-5 h-5" />
          Créer un utilisateur
        </button>
      </div>

      {/* Info importante */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Information importante</h3>
            <p className="mt-2 text-sm text-blue-700">
              Après la création d'un utilisateur ici, vous devez également le créer manuellement dans 
              <strong> Supabase Dashboard → Authentication → Users</strong> avec le même email et mot de passe.
            </p>
          </div>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Aucun utilisateur enregistré</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    u.role === 'admin' 
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                      : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                  }`}>
                    {u.role === 'admin' ? (
                      <Shield className="w-6 h-6 text-white" />
                    ) : (
                      <User className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 break-all">{u.email}</h3>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                      u.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {u.role === 'admin' ? '👑 Administrateur' : '👤 Responsable RH'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date de création */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Créé le {new Date(u.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                {u.email !== currentUser?.email && (
                  <button
                    onClick={() => handleDeleteUser(u.email, u.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </button>
                )}
                {u.email === currentUser?.email && (
                  <div className="flex-1 text-center py-2 text-sm text-gray-500 italic">
                    Votre compte
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Créer utilisateur */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Créer un utilisateur</h2>
              <p className="text-sm text-gray-600 mt-1">
                Créez un compte pour un responsable RH ou administrateur
              </p>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Adresse email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="utilisateur@pointage.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Mot de passe
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="Minimum 6 caractères"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  💡 Conseil : Générez un mot de passe fort et communiquez-le à l'utilisateur
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Rôle
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="hr">👤 Responsable RH</option>
                  <option value="admin">👑 Administrateur</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.role === 'admin' 
                    ? '⚠️ Accès complet : gestion employés, utilisateurs et rapports'
                    : '📋 Accès : gestion employés et pointages uniquement'
                  }
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs text-yellow-800">
                  <strong>⚠️ Étape supplémentaire requise :</strong><br/>
                  Après avoir cliqué sur "Créer", vous devrez aussi créer cet utilisateur dans 
                  Supabase Dashboard → Authentication → Users avec le même email et mot de passe.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setError('')
                  setFormData({ email: '', password: '', role: 'hr' })
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                Créer l'utilisateur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}