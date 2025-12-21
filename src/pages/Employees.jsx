import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { UserPlus, Edit, Trash2, QrCode, Download, Search, Upload, X, User } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [uploading, setUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    department: '',
    matricule: '',
    photo_url: ''
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
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

  const generateMatricule = () => {
    const count = employees.length + 1
    return `EMP${String(count).padStart(4, '0')}`
  }

  const handleOpenAddModal = () => {
    setSelectedEmployee(null)
    setPhotoPreview(null)
    setPhotoFile(null)
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      department: '',
      matricule: generateMatricule(),
      photo_url: ''
    })
    setShowModal(true)
  }

  const handleOpenEditModal = (employee) => {
    setSelectedEmployee(employee)
    setPhotoPreview(employee.photo_url)
    setPhotoFile(null)
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email || '',
      department: employee.department,
      matricule: employee.matricule,
      photo_url: employee.photo_url || ''
    })
    setShowModal(true)
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('La photo ne doit pas dépasser 5MB')
        return
      }

      // Vérifier le type
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une image')
        return
      }

      setPhotoFile(file)
      
      // Créer un aperçu
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadPhoto = async (matricule) => {
    if (!photoFile) return formData.photo_url

    try {
      setUploading(true)
      
      // Créer un nom de fichier unique
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${matricule}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Supprimer l'ancienne photo si elle existe
      if (selectedEmployee?.photo_url) {
        const oldFileName = selectedEmployee.photo_url.split('/').pop()
        await supabase.storage
          .from('employee-photos')
          .remove([oldFileName])
      }

      // Upload la nouvelle photo
      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(filePath, photoFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      // Obtenir l'URL publique
      const { data } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Erreur upload photo:', error)
      alert('Erreur lors de l\'upload de la photo')
      return formData.photo_url
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setUploading(true)

      // Upload de la photo si nécessaire
      const photoUrl = await uploadPhoto(formData.matricule)

      if (selectedEmployee) {
        // Modifier
        const { error } = await supabase
          .from('employees')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            department: formData.department,
            matricule: formData.matricule,
            photo_url: photoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedEmployee.id)

        if (error) throw error
        alert('Employé modifié avec succès !')
      } else {
        // Ajouter
        const { error } = await supabase
          .from('employees')
          .insert([{
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            department: formData.department,
            matricule: formData.matricule,
            qr_code: formData.matricule,
            photo_url: photoUrl
          }])

        if (error) throw error
        alert('Employé ajouté avec succès !')
      }

      setShowModal(false)
      loadEmployees()
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de l\'opération: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${name} ?`)) return

    try {
      const employee = employees.find(e => e.id === id)
      
      // Supprimer la photo si elle existe
      if (employee?.photo_url) {
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
      alert('Employé supprimé avec succès !')
      loadEmployees()
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const downloadQRCode = (employee) => {
    const svg = document.getElementById(`qr-${employee.id}`)
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')
      
      const downloadLink = document.createElement('a')
      downloadLink.download = `QR_${employee.matricule}_${employee.first_name}_${employee.last_name}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  const filteredEmployees = employees.filter(emp => 
    emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des employés</h1>
          <p className="mt-2 text-sm text-gray-700">
            {employees.length} employé{employees.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
        >
          <UserPlus className="w-5 h-5" />
          Ajouter un employé
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Rechercher par nom, matricule ou département..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Liste des employés */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {searchTerm ? 'Aucun employé trouvé' : 'Aucun employé enregistré'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => (
            <div key={employee.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6">
              {/* Photo */}
              <div className="flex justify-center mb-4">
                {employee.photo_url ? (
                  <img 
                    src={employee.photo_url} 
                    alt={`${employee.first_name} ${employee.last_name}`}
                    className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-4 border-indigo-100">
                    <User className="w-12 h-12 text-white" />
                  </div>
                )}
              </div>

              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {employee.first_name} {employee.last_name}
                </h3>
                <p className="text-sm text-gray-600">{employee.department}</p>
                <p className="text-xs text-gray-500 mt-1 font-mono">{employee.matricule}</p>
              </div>

              {/* QR Code miniature */}
              <div className="flex justify-center my-4">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <QRCodeSVG
                    id={`qr-${employee.id}`}
                    value={employee.qr_code}
                    size={100}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedEmployee(employee)
                    setShowQRModal(true)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm"
                >
                  <QrCode className="w-4 h-4" />
                  QR
                </button>
                <button
                  onClick={() => handleOpenEditModal(employee)}
                  className="flex items-center justify-center p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(employee.id, `${employee.first_name} ${employee.last_name}`)}
                  className="flex items-center justify-center p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ajouter/Modifier */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedEmployee ? 'Modifier l\'employé' : 'Ajouter un employé'}
              </h2>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Photo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo de profil</label>
                <div className="flex flex-col items-center gap-4">
                  {photoPreview ? (
                    <div className="relative">
                      <img 
                        src={photoPreview} 
                        alt="Aperçu"
                        className="w-32 h-32 rounded-full object-cover border-4 border-indigo-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null)
                          setPhotoFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                      <User className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    {photoPreview ? 'Changer la photo' : 'Ajouter une photo'}
                  </label>
                  <p className="text-xs text-gray-500">JPG, PNG ou GIF (Max 5MB)</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prénom *</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom *</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Département *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Sélectionner...</option>
                  <option value="Production">Production</option>
                  <option value="Administration">Administration</option>
                  <option value="Logistique">Logistique</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Qualité">Qualité</option>
                  <option value="Commercial">Commercial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Matricule *</label>
                <input
                  type="text"
                  value={formData.matricule}
                  onChange={(e) => setFormData({...formData, matricule: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={uploading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Upload...
                  </>
                ) : (
                  selectedEmployee ? 'Modifier' : 'Ajouter'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {showQRModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">QR Code</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedEmployee.first_name} {selectedEmployee.last_name}
              </p>
            </div>

            <div className="p-8 flex flex-col items-center">
              <div className="p-4 bg-white border-4 border-indigo-600 rounded-xl shadow-lg">
                <QRCodeSVG
                  id={`qr-large-${selectedEmployee.id}`}
                  value={selectedEmployee.qr_code}
                  size={250}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="mt-4 text-sm text-gray-600 font-mono">{selectedEmployee.matricule}</p>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowQRModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Fermer
              </button>
              <button
                onClick={() => downloadQRCode(selectedEmployee)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}