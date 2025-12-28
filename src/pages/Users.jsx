import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Users as UsersIcon, UserPlus, Trash2, Shield, User, AlertCircle, ExternalLink } from 'lucide-react'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [newUserData, setNewUserData] = useState(null)
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user'
  })

  useEffect(() => {
    loadCurrentUser()
    loadUsers()

    // Synchronisation temps réel
    const channel = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          console.log('🔄 Changement utilisateurs:', payload)
          loadUsers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
      
      console.log('👥 Utilisateurs chargés:', data?.length || 0)
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
      setError('❌ Tous les champs sont obligatoires')
      return
    }

    if (newUser.password.length < 6) {
      setError('❌ Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    // Sauvegarder les données pour les instructions
    setNewUserData({
      email: newUser.email,
      password: newUser.password,
      full_name: newUser.full_name,
      role: newUser.role
    })

    // Afficher les instructions
    setShowModal(false)
    setShowInstructions(true)
    setNewUser({ email: '', password: '', full_name: '', role: 'user' })
  }

  const handleDeleteUser = async (userId, userEmail) => {
    if (userId === currentUser?.id) {
      alert('❌ Vous ne pouvez pas supprimer votre propre compte')
      return
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${userEmail} ?\n\n⚠️ N'oubliez pas de le supprimer aussi dans:\nSupabase > Authentication > Users`)) return

    try {
      // Supprimer de la table users
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (dbError) throw dbError

      await loadUsers()
      alert('✅ Utilisateur supprimé de la table users\n\n⚠️ Pour suppression complète:\nSupabase > Authentication > Users > Supprimer')
      
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('❌ Erreur: ' + error.message)
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
      {/* Instructions pour créer des utilisateurs */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-2">Comment créer un utilisateur</p>
            <ol className="text-blue-700 space-y-1 ml-4 list-decimal">
              <li>Cliquez sur "Nouvel utilisateur" pour obtenir les instructions</li>
              <li>Suivez le guide pour créer via Supabase Dashboard</li>
              <li>L'utilisateur apparaîtra automatiquement dans la liste</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gérer les accès à l'application ({users.length} utilisateur{users.length > 1 ? 's' : ''})
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
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
          </div>
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

      {/* Modal Instructions */}
      {showInstructions && newUserData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">📋 Instructions : Créer l'utilisateur</h2>
            
            <div className="space-y-6">
              {/* Étape 1 */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h3 className="font-bold text-blue-900 mb-2">ÉTAPE 1 : Créer dans Supabase Authentication</h3>
                <ol className="text-sm text-blue-800 space-y-2 ml-4 list-decimal">
                  <li>Ouvrez Supabase Dashboard → <strong>Authentication</strong> → <strong>Users</strong></li>
                  <li>Cliquez <strong>"Add user"</strong> → <strong>"Create new user"</strong></li>
                  <li>Remplissez :
                    <div className="bg-white p-3 rounded mt-2 font-mono text-xs">
                      <div>Email: <strong className="text-blue-600">{newUserData.email}</strong></div>
                      <div>Password: <strong className="text-blue-600">{newUserData.password}</strong></div>
                      <div>Auto Confirm User: <strong className="text-green-600">✅ COCHER</strong></div>
                    </div>
                  </li>
                  <li>Cliquez <strong>"Create user"</strong></li>
                  <li className="text-red-600 font-semibold">⚠️ IMPORTANT : Copiez l'ID généré (ex: abc-123-def...)</li>
                </ol>
              </div>

              {/* Étape 2 */}
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <h3 className="font-bold text-green-900 mb-2">ÉTAPE 2 : Ajouter dans la table users</h3>
                <ol className="text-sm text-green-800 space-y-2 ml-4 list-decimal">
                  <li>Supabase Dashboard → <strong>SQL Editor</strong></li>
                  <li>Copiez ce script et <strong>remplacez l'ID</strong> par celui copié à l'étape 1 :</li>
                </ol>
                <div className="bg-gray-900 text-gray-100 p-4 rounded mt-2 font-mono text-xs overflow-x-auto">
                  <pre>{`INSERT INTO users (id, email, full_name, role)
VALUES (
  'REMPLACEZ-PAR-ID-COPIÉ',
  '${newUserData.email}',
  '${newUserData.full_name}',
  '${newUserData.role}'
);`}</pre>
                </div>
                <p className="text-xs text-green-700 mt-2">💡 Exemple d'ID : a1b2c3d4-e5f6-7890-abcd-ef1234567890</p>
              </div>

              {/* Étape 3 */}
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                <h3 className="font-bold text-purple-900 mb-2">ÉTAPE 3 : Vérification</h3>
                <p className="text-sm text-purple-800 mb-2">Exécutez ce script pour vérifier :</p>
                <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
                  <pre>{`SELECT * FROM users WHERE email = '${newUserData.email}';`}</pre>
                </div>
                <p className="text-xs text-purple-700 mt-2">✅ L'utilisateur doit apparaître dans la liste automatiquement</p>
              </div>

              {/* Info supplémentaire */}
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="text-sm text-yellow-800">
                  <strong>📌 Mot de passe à transmettre :</strong> {newUserData.password}
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  L'utilisateur peut maintenant se connecter avec ces identifiants.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowInstructions(false)
                  setNewUserData(null)
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  loadUsers()
                  setShowInstructions(false)
                  setNewUserData(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                🔄 Rafraîchir la liste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Formulaire */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Nouvel utilisateur</h2>
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
                </div>
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
                  placeholder="Jaouad El Alami"
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
                  type="text"
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
                  Voir instructions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
