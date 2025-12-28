import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Users as UsersIcon, UserPlus, Trash2, Shield, User } from 'lucide-react'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user'
  })

  useEffect(() => {
    loadCurrentUser()
    loadUsers()
  }, [])

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error)
      setError('Impossible de charger les utilisateurs')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      setError('Tous les champs sont obligatoires')
      return
    }

    if (newUser.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    try {
      console.log('📧 Création utilisateur:', newUser.email)

      // Utiliser signUp classique
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.full_name
          },
          emailRedirectTo: undefined
        }
      })

      console.log('🔐 Réponse Auth:', authData, authError)

      if (authError) {
        console.error('❌ Erreur Auth:', authError)
        throw authError
      }

      if (!authData?.user) {
        throw new Error('Utilisateur non créé.\n\nVérifiez que la confirmation email est désactivée:\nSupabase > Authentication > Providers > Email > Désactivez "Enable email confirmations"')
      }

      console.log('✅ Utilisateur Auth créé:', authData.user.id)

      // Créer dans la table users
      const { error: dbError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role
        }])

      if (dbError) {
        console.error('❌ Erreur DB:', dbError)
        throw dbError
      }

      console.log('✅ Utilisateur DB créé')

      // Succès
      setShowModal(false)
      setNewUser({ email: '', password: '', full_name: '', role: 'user' })
      loadUsers()
      alert('✅ Utilisateur créé avec succès!')

    } catch (error) {
      console.error('❌ Erreur complète:', error)
      
      let errorMsg = error.message || 'Erreur inconnue'
      
      if (errorMsg.includes('JSON') || errorMsg.includes('Unexpected end')) {
        errorMsg = '⚠️ ERREUR DE CONFIGURATION\n\nLa confirmation email est activée.\n\nSOLUTION:\n1. Allez sur Supabase Dashboard\n2. Authentication > Providers > Email\n3. Désactivez "Enable email confirmations"\n4. Sauvegardez et réessayez'
      } else if (errorMsg.includes('already registered') || errorMsg.includes('already been registered')) {
        errorMsg = '⚠️ Cet email est déjà utilisé'
      } else if (errorMsg.includes('Invalid email')) {
        errorMsg = '⚠️ Format d\'email invalide'
      } else if (errorMsg.includes('Password')) {
        errorMsg = '⚠️ Mot de passe trop faible (min 6 caractères)'
      }
      
      setError(errorMsg)
      alert('❌ ERREUR\n\n' + errorMsg)
    }
  }

  const handleDeleteUser = async (userId, userEmail) => {
    if (userId === currentUser?.id) {
      alert('❌ Vous ne pouvez pas supprimer votre propre compte')
      return
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${userEmail} ?`)) return

    try {
      // Supprimer de la table users
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (dbError) throw dbError

      loadUsers()
      alert('✅ Utilisateur supprimé')
      
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('❌ Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gérer les accès à l'application
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true)
            setError('')
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <UserPlus className="w-5 h-5" />
          Nouvel utilisateur
        </button>
      </div>

      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                  <UsersIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  Aucun utilisateur
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'admin' ? (
                        <><Shield className="w-3 h-3 mr-1" /> Admin</>
                      ) : (
                        <><User className="w-3 h-3 mr-1" /> Utilisateur</>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      disabled={user.id === currentUser?.id}
                      className={`text-red-600 hover:text-red-900 ${
                        user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={user.id === currentUser?.id ? 'Vous ne pouvez pas vous supprimer' : 'Supprimer'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Création */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Nouvel utilisateur</h2>
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ahmed El Alami"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="utilisateur@sahara.ma"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe *
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Min 6 caractères"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle *
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setError('')
                    setNewUser({ email: '', password: '', full_name: '', role: 'user' })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
