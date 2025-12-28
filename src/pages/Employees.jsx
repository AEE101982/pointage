import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Users, UserPlus, Edit2, Trash2, QrCode, Download } from 'lucide-react'

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    matricule: '',
    first_name: '',
    last_name: '',
    department: '',
    position: '',
    monthly_salary: '',
    hourly_rate: '',
    contract_type: 'CDI',
    hire_date: '',
    photo_url: '',
    qr_code: ''
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      // SELECT * pour charger toutes les colonnes incluant qr_code
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('first_name', { ascending: true })

      if (error) throw error
      
      console.log('Employés chargés avec QR codes:', data)
      setEmployees(data || [])
    } catch (error) {
      console.error('Erreur chargement employés:', error)
      setError('Impossible de charger les employés')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(formData)
          .eq('id', editingEmployee.id)

        if (error) throw error
        
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([formData])

        if (error) throw error
      }

      await loadEmployees()
      resetForm()
      setShowModal(false)
      
    } catch (error) {
      console.error('Erreur:', error)
      setError(error.message)
    }
  }

  const handleEdit = (employee) => {
    setEditingEmployee(employee)
    setFormData({
      matricule: employee.matricule || '',
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      department: employee.department || '',
      position: employee.position || '',
      monthly_salary: employee.monthly_salary || '',
      hourly_rate: employee.hourly_rate || '',
      contract_type: employee.contract_type || 'CDI',
      hire_date: employee.hire_date || '',
      photo_url: employee.photo_url || '',
      qr_code: employee.qr_code || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) return

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      await loadEmployees()
      
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const showQRCode = (employee) => {
    setSelectedEmployee(employee)
    setShowQRModal(true)
  }

  const downloadQRCode = (employee) => {
    if (!employee.qr_code) {
      alert('Aucun QR code disponible pour cet employé')
      return
    }

    // Si c'est une URL
    if (employee.qr_code.startsWith('http')) {
      window.open(employee.qr_code, '_blank')
    } 
    // Si c'est du base64
    else if (employee.qr_code.startsWith('data:image')) {
      const link = document.createElement('a')
      link.href = employee.qr_code
      link.download = `qr_code_${employee.matricule}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    // Si c'est juste le texte du QR
    else {
      alert(`QR Code: ${employee.qr_code}`)
    }
  }

  const resetForm = () => {
    setFormData({
      matricule: '',
      first_name: '',
      last_name: '',
      department: '',
      position: '',
      monthly_salary: '',
      hourly_rate: '',
      contract_type: 'CDI',
      hire_date: '',
      photo_url: '',
      qr_code: ''
    })
    setEditingEmployee(null)
    setError('')
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
          <h1 className="text-3xl font-bold text-gray-900">Employés</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gérer les employés de l'entreprise ({employees.length} employé{employees.length > 1 ? 's' : ''})
          </p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <UserPlus className="w-5 h-5" />
          Nouvel employé
        </button>
      </div>

      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matricule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Département</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salaire</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">QR Code</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  Aucun employé
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {employee.matricule}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {employee.photo_url ? (
                          <img className="h-10 w-10 rounded-full object-cover" src={employee.photo_url} alt="" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Users className="h-6 w-6 text-indigo-600" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{employee.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.monthly_salary ? `${parseFloat(employee.monthly_salary).toLocaleString()} MAD` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {employee.qr_code ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => showQRCode(employee)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Voir QR Code"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => downloadQRCode(employee)}
                          className="text-green-600 hover:text-green-900"
                          title="Télécharger QR Code"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Non disponible</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="text-red-600 hover:text-red-900"
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

      {/* Modal QR Code */}
      {showQRModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              QR Code - {selectedEmployee.first_name} {selectedEmployee.last_name}
            </h2>
            
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-4">Matricule: {selectedEmployee.matricule}</p>
              
              {selectedEmployee.qr_code ? (
                // Si c'est une URL ou du base64
                (selectedEmployee.qr_code.startsWith('http') || selectedEmployee.qr_code.startsWith('data:image')) ? (
                  <img 
                    src={selectedEmployee.qr_code} 
                    alt="QR Code"
                    className="mx-auto w-64 h-64 object-contain border-4 border-indigo-200 rounded-lg shadow-lg"
                  />
                ) : (
                  // Si c'est juste du texte
                  <div className="bg-gray-100 p-6 rounded-lg">
                    <p className="font-mono text-sm break-all">{selectedEmployee.qr_code}</p>
                  </div>
                )
              ) : (
                <p className="text-red-600">QR Code non disponible</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowQRModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Fermer
              </button>
              {selectedEmployee.qr_code && (
                <button
                  onClick={() => downloadQRCode(selectedEmployee)}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Download className="w-5 h-5 inline mr-2" />
                  Télécharger
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Formulaire */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingEmployee ? 'Modifier l\'employé' : 'Nouvel employé'}
            </h2>
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matricule *
                  </label>
                  <input
                    type="text"
                    value={formData.matricule}
                    onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="M001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Département
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Poste
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salaire mensuel (MAD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.monthly_salary}
                    onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux horaire (MAD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de contrat
                  </label>
                  <select
                    value={formData.contract_type}
                    onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Stage">Stage</option>
                    <option value="Intérim">Intérim</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date d'embauche
                  </label>
                  <input
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Photo
                  </label>
                  <input
                    type="text"
                    value={formData.photo_url}
                    onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingEmployee ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
