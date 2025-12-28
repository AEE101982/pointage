import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { DollarSign, Plus, Check, X, Printer, AlertCircle } from 'lucide-react'

export default function SalaryAdvances({ user }) {
  const [advances, setAdvances] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    employee_id: '',
    amount: '',
    reason: '',
    request_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadAdvances()
    loadEmployees()

    // Synchronisation temps réel
    const channel = supabase
      .channel('salary-advances-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salary_advances'
        },
        () => {
          loadAdvances()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadAdvances = async () => {
    try {
      const { data, error } = await supabase
        .from('salary_advances')
        .select(`
          *,
          employees!salary_advances_employee_id_fkey (
            id,
            first_name,
            last_name,
            matricule,
            monthly_salary,
            department
          ),
          requested_by_user:users!salary_advances_requested_by_fkey (full_name),
          approved_by_user:users!salary_advances_approved_by_fkey (full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('Avances chargées:', data)
      setAdvances(data || [])
    } catch (error) {
      console.error('Erreur chargement avances:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, matricule, monthly_salary')
        .order('first_name', { ascending: true })

      if (error) throw error
      
      console.log('Employés chargés:', data)
      setEmployees(data || [])
    } catch (error) {
      console.error('Erreur chargement employés:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      const { error } = await supabase
        .from('salary_advances')
        .insert([{
          employee_id: formData.employee_id,
          amount: parseFloat(formData.amount),
          reason: formData.reason,
          request_date: formData.request_date,
          requested_by: user.id,
          status: 'pending'
        }])

      if (error) throw error
      
      await loadAdvances()
      setShowModal(false)
      resetForm()
      
    } catch (error) {
      console.error('Erreur:', error)
      setError(error.message)
    }
  }

  const handleApprove = async (advanceId) => {
    if (!user || user.role !== 'admin') {
      alert('Seuls les administrateurs peuvent approuver')
      return
    }

    try {
      const { error } = await supabase
        .from('salary_advances')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', advanceId)

      if (error) throw error
      
      await loadAdvances()
      
    } catch (error) {
      console.error('Erreur approbation:', error)
      alert('Erreur lors de l\'approbation')
    }
  }

  const handleReject = async (advanceId) => {
    if (!user || user.role !== 'admin') {
      alert('Seuls les administrateurs peuvent rejeter')
      return
    }

    const reason = prompt('Raison du rejet :')
    if (!reason) return

    try {
      const { error } = await supabase
        .from('salary_advances')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', advanceId)

      if (error) throw error
      
      await loadAdvances()
      
    } catch (error) {
      console.error('Erreur rejet:', error)
      alert('Erreur lors du rejet')
    }
  }

  const printDocument = (advance) => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Demande d'avance sur salaire - ${advance.employees?.matricule}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; margin-bottom: 40px; }
          .header h1 { color: #991B1B; margin: 0; }
          .header p { color: #6B7280; margin: 5px 0; }
          .content { margin: 30px 0; }
          .row { display: flex; justify-content: space-between; margin: 15px 0; }
          .label { font-weight: bold; }
          .amount { font-size: 24px; font-weight: bold; color: #991B1B; margin: 20px 0; }
          .signature { margin-top: 80px; }
          .signature-block { display: inline-block; width: 45%; text-align: center; }
          .signature-line { border-top: 2px solid black; margin-top: 60px; padding-top: 10px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SAHARA MOBILIER</h1>
          <p>Usine de Fabrication</p>
          <p>Demande d'Avance sur Salaire</p>
        </div>
        
        <div class="content">
          <div class="row">
            <span><span class="label">Date :</span> ${new Date(advance.request_date).toLocaleDateString('fr-FR')}</span>
            <span><span class="label">N° Demande :</span> ${advance.id.substring(0, 8).toUpperCase()}</span>
          </div>
          
          <div class="row">
            <span><span class="label">Matricule :</span> ${advance.employees?.matricule || 'N/A'}</span>
          </div>
          
          <div class="row">
            <span><span class="label">Nom et Prénom :</span> ${advance.employees?.first_name} ${advance.employees?.last_name}</span>
          </div>
          
          <div class="row">
            <span><span class="label">Département :</span> ${advance.employees?.department || 'N/A'}</span>
          </div>
          
          <div class="row">
            <span><span class="label">Salaire Mensuel :</span> ${parseFloat(advance.employees?.monthly_salary || 0).toLocaleString()} MAD</span>
          </div>
          
          <div class="amount">
            <span class="label">Montant de l'avance :</span> ${parseFloat(advance.amount).toLocaleString()} MAD
          </div>
          
          <div class="row">
            <span><span class="label">Motif :</span> ${advance.reason}</span>
          </div>
          
          <div class="row">
            <span><span class="label">Demandé par :</span> ${advance.requested_by_user?.full_name || 'N/A'}</span>
          </div>
          
          <div class="row">
            <span><span class="label">Approuvé par :</span> ${advance.approved_by_user?.full_name || 'N/A'}</span>
            <span><span class="label">Date approbation :</span> ${advance.approved_at ? new Date(advance.approved_at).toLocaleDateString('fr-FR') : 'N/A'}</span>
          </div>
        </div>
        
        <div class="signature">
          <div class="signature-block">
            <div class="signature-line">
              <strong>Signature de l'employé</strong>
            </div>
          </div>
          
          <div class="signature-block" style="float: right;">
            <div class="signature-line">
              <strong>Signature du Directeur</strong><br>
              <small>Cachet de l'entreprise</small>
            </div>
          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const resetForm = () => {
    setFormData({
      employee_id: '',
      amount: '',
      reason: '',
      request_date: new Date().toISOString().split('T')[0]
    })
    setError('')
  }

  const stats = {
    pending: advances.filter(a => a.status === 'pending').length,
    approved: advances.filter(a => a.status === 'approved').length,
    totalApproved: advances
      .filter(a => a.status === 'approved')
      .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0)
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
          <h1 className="text-3xl font-bold text-gray-900">Avances sur Salaire</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gérer les demandes d'avances
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" />
          Nouvelle demande
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">En attente</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">{stats.pending}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-yellow-500" />
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Approuvées</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{stats.approved}</p>
            </div>
            <Check className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">Montant total approuvé</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{stats.totalApproved.toLocaleString()} MAD</p>
            </div>
            <DollarSign className="w-12 h-12 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Liste des avances */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matricule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motif</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {advances.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                  Aucune demande d'avance
                </td>
              </tr>
            ) : (
              advances.map((advance) => (
                <tr key={advance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {advance.employees?.first_name} {advance.employees?.last_name}
                    </div>
                    <div className="text-sm text-gray-500">{advance.employees?.department}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {advance.employees?.matricule}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {parseFloat(advance.amount).toLocaleString()} MAD
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {advance.reason}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      advance.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      advance.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {advance.status === 'pending' ? '🟡 En attente' :
                       advance.status === 'approved' ? '🟢 Approuvée' :
                       '🔴 Rejetée'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {advance.status === 'pending' && user?.role === 'admin' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApprove(advance.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Approuver"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleReject(advance.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Rejeter"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {advance.status === 'approved' && (
                      <button
                        onClick={() => printDocument(advance)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Imprimer"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Nouvelle demande d'avance</h2>
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employé *
                </label>
                <select
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Sélectionner un employé</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.matricule} - {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant (MAD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="500.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motif *
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Raison de la demande d'avance"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de la demande *
                </label>
                <input
                  type="date"
                  value={formData.request_date}
                  onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
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
