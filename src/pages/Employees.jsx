import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { Users as UsersIcon, UserPlus, Edit, Trash2, QrCode as QrCodeIcon, Download, DollarSign, Camera, Upload, X } from 'lucide-react'

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    employee_id: '',
    department: '',
    position: '',
    phone: '',
    email: '',
    photo_url: '',
    monthly_salary: '',
    overtime_rate: '',
    hire_date: '',
    contract_type: 'CDI',
    contract_end_date: ''
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Erreur chargement employés:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image')
      return
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('La photo ne doit pas dépasser 2 MB')
      return
    }

    try {
      setUploadingPhoto(true)

      // Créer un aperçu local
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)

      // Générer un nom de fichier unique
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${fileName}`

      // Upload vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(filePath)

      // Mettre à jour le formulaire
      setFormData({ ...formData, photo_url: publicUrl })
      
      console.log('✅ Photo uploadée:', publicUrl)

    } catch (error) {
      console.error('Erreur upload photo:', error)
      alert('Erreur lors de l\'upload de la photo: ' + error.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const removePhoto = async () => {
    if (formData.photo_url) {
      // Supprimer du storage si c'est une URL Supabase
      if (formData.photo_url.includes('employee-photos')) {
        try {
          const fileName = formData.photo_url.split('/').pop()
          await supabase.storage
            .from('employee-photos')
            .remove([fileName])
        } catch (error) {
          console.error('Erreur suppression photo:', error)
        }
      }
    }
    
    setFormData({ ...formData, photo_url: '' })
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const generateQRCode = (employeeId) => {
    return `EMP${employeeId.toString().padStart(4, '0')}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const monthlySalary = parseFloat(formData.monthly_salary) || 0
      const hourlyRate = monthlySalary / 191
      const overtimeRate = parseFloat(formData.overtime_rate) || (hourlyRate * 1.5)

      const employeeData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        employee_id: formData.employee_id,
        department: formData.department,
        position: formData.position,
        phone: formData.phone,
        email: formData.email,
        photo_url: formData.photo_url,
        monthly_salary: monthlySalary,
        hourly_rate: hourlyRate.toFixed(2),
        overtime_rate: overtimeRate.toFixed(2),
        hire_date: formData.hire_date || null,
        contract_type: formData.contract_type,
        contract_end_date: formData.contract_type === 'CDD' ? formData.contract_end_date : null
      }

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id)

        if (error) throw error
      } else {
        employeeData.qr_code = generateQRCode(Date.now())
        
        const { error } = await supabase
          .from('employees')
          .insert([employeeData])

        if (error) throw error
      }

      setShowModal(false)
      setEditingEmployee(null)
      setPhotoPreview(null)
      setFormData({
        first_name: '',
        last_name: '',
        employee_id: '',
        department: '',
        position: '',
        phone: '',
        email: '',
        photo_url: '',
        monthly_salary: '',
        overtime_rate: '',
        hire_date: '',
        contract_type: 'CDI',
        contract_end_date: ''
      })
      loadEmployees()
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de l\'enregistrement')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) return

    try {
      // Récupérer l'employé pour supprimer sa photo
      const employee = employees.find(e => e.id === id)
      if (employee?.photo_url && employee.photo_url.includes('employee-photos')) {
        const fileName = employee.photo_url.split('/').pop()
        await supabase.storage
          .from('employee-photos')
          .remove([fileName])
      }

      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadEmployees()
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const openEditModal = (employee) => {
    setEditingEmployee(employee)
    setFormData({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      employee_id: employee.employee_id || '',
      department: employee.department || '',
      position: employee.position || '',
      phone: employee.phone || '',
      email: employee.email || '',
      photo_url: employee.photo_url || '',
      monthly_salary: employee.monthly_salary || '',
      overtime_rate: employee.overtime_rate || '',
      hire_date: employee.hire_date || '',
      contract_type: employee.contract_type || 'CDI',
      contract_end_date: employee.contract_end_date || ''
    })
    setPhotoPreview(employee.photo_url || null)
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingEmployee(null)
    setPhotoPreview(null)
    setFormData({
      first_name: '',
      last_name: '',
      employee_id: '',
      department: '',
      position: '',
      phone: '',
      email: '',
      photo_url: '',
      monthly_salary: '',
      overtime_rate: '',
      hire_date: '',
      contract_type: 'CDI',
      contract_end_date: ''
    })
    setShowModal(true)
  }

  const downloadQRCode = (employee) => {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${employee.qr_code}`
    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `qrcode_${employee.first_name}_${employee.last_name}.png`
    link.click()
  }

  const getContractStatus = (employee) => {
    if (employee.contract_type === 'CDI') {
      return { text: 'CDI', color: 'bg-green-100 text-green-800' }
    }
    
    if (employee.contract_end_date) {
      const endDate = new Date(employee.contract_end_date)
      const today = new Date()
      const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
      
      if (daysRemaining < 0) {
        return { text: 'CDD Expiré', color: 'bg-red-100 text-red-800' }
      } else if (daysRemaining <= 30) {
        return { text: `CDD (${daysRemaining}j)`, color: 'bg-orange-100 text-orange-800' }
      } else {
        return { text: 'CDD', color: 'bg-blue-100 text-blue-800' }
      }
    }
    
    return { text: 'CDD', color: 'bg-blue-100 text-blue-800' }
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
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Employés</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gérer les employés et leurs informations de paie
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <UserPlus className="w-5 h-5" />
          Nouvel employé
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matricule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Poste</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salaire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taux HS</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    <UsersIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    Aucun employé
                  </td>
                </tr>
              ) : (
                employees.map((employee) => {
                  const contractStatus = getContractStatus(employee)
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {employee.photo_url ? (
                          <img 
                            src={employee.photo_url} 
                            alt={`${employee.first_name} ${employee.last_name}`}
                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <UsersIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.employee_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{employee.department}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.position}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${contractStatus.color}`}>
                          {contractStatus.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {employee.monthly_salary ? `${parseFloat(employee.monthly_salary).toLocaleString()} MAD` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-semibold">
                        {employee.overtime_rate ? `${parseFloat(employee.overtime_rate).toFixed(2)} MAD/h` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => downloadQRCode(employee)}
                          className="text-purple-600 hover:text-purple-900 mr-3"
                          title="Télécharger QR Code"
                        >
                          <QrCodeIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openEditModal(employee)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingEmployee ? 'Modifier l\'employé' : 'Nouvel employé'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Photo */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Photo de profil
                  </h3>
                  
                  <div className="flex items-center gap-6">
                    {/* Aperçu */}
                    <div className="flex-shrink-0">
                      {photoPreview ? (
                        <div className="relative">
                          <img 
                            src={photoPreview} 
                            alt="Aperçu" 
                            className="w-32 h-32 rounded-full object-cover border-4 border-indigo-100"
                          />
                          <button
                            type="button"
                            onClick={removePhoto}
                            className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                          <Camera className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Upload */}
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className={`inline-flex items-center gap-2 px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer transition ${
                          uploadingPhoto ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Upload className="w-5 h-5" />
                        {uploadingPhoto ? 'Upload en cours...' : 'Choisir une photo'}
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        JPG, PNG ou GIF. Max 2 MB.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informations personnelles */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <UsersIcon className="w-5 h-5" />
                    Informations personnelles
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Matricule *</label>
                      <input
                        type="text"
                        value={formData.employee_id}
                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Poste</label>
                      <input
                        type="text"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Informations contractuelles */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <QrCodeIcon className="w-5 h-5" />
                    Informations contractuelles
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date d'embauche</label>
                      <input
                        type="date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type de contrat</label>
                      <select
                        value={formData.contract_type}
                        onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="CDI">CDI (Contrat à Durée Indéterminée)</option>
                        <option value="CDD">CDD (Contrat à Durée Déterminée)</option>
                      </select>
                    </div>

                    {formData.contract_type === 'CDD' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin de contrat</label>
                        <input
                          type="date"
                          value={formData.contract_end_date}
                          onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Informations de paie */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Informations de paie
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Salaire mensuel net (MAD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.monthly_salary}
                        onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="5000.00"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Taux horaire calculé automatiquement (base 191h/mois)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Taux horaire supplémentaire (MAD/h)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.overtime_rate}
                        onChange={(e) => setFormData({ ...formData, overtime_rate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="Auto (1.5x taux normal)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Laissez vide pour 1.5x le taux normal
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingEmployee(null)
                      setPhotoPreview(null)
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingPhoto}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {editingEmployee ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
