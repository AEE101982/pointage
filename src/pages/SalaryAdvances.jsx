import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { 
  DollarSign, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText,
  Printer,
  Calendar
} from 'lucide-react'

export default function SalaryAdvances({ user }) {
  const [advances, setAdvances] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  
  const [newAdvance, setNewAdvance] = useState({
    employee_id: '',
    amount: '',
    reason: ''
  })

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    loadEmployees()
    loadAdvances()

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
        (payload) => {
          console.log('🔄 Changement avances:', payload)
          loadAdvances()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_id, monthly_salary')
        .order('first_name')

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Erreur chargement employés:', error)
    }
  }

  const loadAdvances = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('salary_advances')
        .select(`
          *,
          employees (
            id,
            first_name,
            last_name,
            employee_id,
            monthly_salary,
            department
          ),
          requested_by_user:users!salary_advances_requested_by_fkey (
            full_name
          ),
          approved_by_user:users!salary_advances_approved_by_fkey (
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      // Si utilisateur non-admin, voir seulement ses demandes
      if (!isAdmin) {
        query = query.eq('requested_by', user.id)
      }

      const { data, error } = await query

      if (error) throw error
      setAdvances(data || [])
    } catch (error) {
      console.error('Erreur chargement avances:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAdvance = async (e) => {
    e.preventDefault()
    setError('')

    try {
      if (!newAdvance.employee_id || !newAdvance.amount) {
        throw new Error('Tous les champs obligatoires doivent être remplis')
      }

      const amount = parseFloat(newAdvance.amount)
      if (amount <= 0) {
        throw new Error('Le montant doit être supérieur à 0')
      }

      // Vérifier le salaire de l'employé
      const employee = employees.find(e => e.id === newAdvance.employee_id)
      if (employee && amount > employee.monthly_salary * 0.5) {
        if (!confirm(`Le montant demandé (${amount} MAD) dépasse 50% du salaire mensuel (${employee.monthly_salary} MAD). Continuer ?`)) {
          return
        }
      }

      const { error: insertError } = await supabase
        .from('salary_advances')
        .insert([{
          employee_id: newAdvance.employee_id,
          requested_by: user.id,
          amount: amount,
          reason: newAdvance.reason || null,
          request_date: new Date().toISOString().split('T')[0],
          month_applied: new Date().toISOString().slice(0, 7) // YYYY-MM
        }])

      if (insertError) throw insertError

      setShowModal(false)
      setNewAdvance({ employee_id: '', amount: '', reason: '' })
      loadAdvances()
      alert('✅ Demande d\'avance créée avec succès!')

    } catch (error) {
      console.error('Erreur création avance:', error)
      setError(error.message)
      alert('❌ Erreur: ' + error.message)
    }
  }

  const handleApprove = async (advanceId) => {
    if (!confirm('Approuver cette demande d\'avance ?')) return

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

      loadAdvances()
      alert('✅ Avance approuvée!')
    } catch (error) {
      console.error('Erreur approbation:', error)
      alert('❌ Erreur: ' + error.message)
    }
  }

  const handleReject = async (advanceId) => {
    const reason = prompt('Raison du rejet:')
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

      loadAdvances()
      alert('✅ Avance rejetée')
    } catch (error) {
      console.error('Erreur rejet:', error)
      alert('❌ Erreur: ' + error.message)
    }
  }

  const printDocument = (advance) => {
    // Ouvrir une nouvelle fenêtre pour l'impression
    const printWindow = window.open('', '_blank')
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Avance sur Salaire - ${advance.employees.first_name} ${advance.employees.last_name}</title>
        <style>
          @page { margin: 2cm; }
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6;
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 40px;
            border-bottom: 3px solid #8B1A1A;
            padding-bottom: 20px;
          }
          .header h1 { 
            color: #8B1A1A; 
            margin: 0;
            font-size: 28px;
          }
          .header p { 
            margin: 5px 0;
            color: #666;
          }
          .content { 
            margin: 30px 0;
            font-size: 14px;
          }
          .info-table {
            width: 100%;
            margin: 20px 0;
            border-collapse: collapse;
          }
          .info-table td {
            padding: 10px;
            border: 1px solid #ddd;
          }
          .info-table td:first-child {
            font-weight: bold;
            background-color: #f5f5f5;
            width: 200px;
          }
          .amount {
            font-size: 24px;
            font-weight: bold;
            color: #8B1A1A;
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            border: 2px solid #8B1A1A;
            background-color: #fff5f5;
          }
          .signatures {
            margin-top: 80px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            text-align: center;
            width: 45%;
          }
          .signature-line {
            border-top: 2px solid #333;
            margin-top: 60px;
            padding-top: 10px;
          }
          .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          .stamp-box {
            margin-top: 20px;
            padding: 40px;
            border: 2px dashed #ccc;
            text-align: center;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SAHARA MOBILIER</h1>
          <p>Usine de Fabrication de Meubles</p>
          <p style="font-weight: bold; margin-top: 20px; font-size: 18px;">ATTESTATION D'AVANCE SUR SALAIRE</p>
        </div>

        <div class="content">
          <p><strong>Date:</strong> ${new Date(advance.approved_at || advance.created_at).toLocaleDateString('fr-FR')}</p>
          
          <table class="info-table">
            <tr>
              <td>Matricule</td>
              <td>${advance.employees.employee_id}</td>
            </tr>
            <tr>
              <td>Nom et Prénom</td>
              <td>${advance.employees.first_name} ${advance.employees.last_name}</td>
            </tr>
            <tr>
              <td>Département</td>
              <td>${advance.employees.department || 'N/A'}</td>
            </tr>
            <tr>
              <td>Salaire Mensuel</td>
              <td>${parseFloat(advance.employees.monthly_salary).toLocaleString()} MAD</td>
            </tr>
            <tr>
              <td>Date de demande</td>
              <td>${new Date(advance.request_date).toLocaleDateString('fr-FR')}</td>
            </tr>
            <tr>
              <td>Motif</td>
              <td>${advance.reason || 'Non spécifié'}</td>
            </tr>
          </table>

          <div class="amount">
            MONTANT DE L'AVANCE: ${parseFloat(advance.amount).toLocaleString()} MAD
          </div>

          <p style="margin: 30px 0; text-align: justify;">
            Je soussigné(e) <strong>${advance.employees.first_name} ${advance.employees.last_name}</strong>, 
            matricule <strong>${advance.employees.employee_id}</strong>, reconnais avoir reçu la somme de 
            <strong>${parseFloat(advance.amount).toLocaleString()} MAD</strong> (${this.numberToWords(advance.amount)}) 
            à titre d'avance sur mon salaire du mois de <strong>${new Date(advance.month_applied + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</strong>.
          </p>

          <p style="text-align: justify;">
            Cette somme sera déduite de ma paie du mois susmentionné.
          </p>

          <div class="signatures">
            <div class="signature-box">
              <p><strong>L'Employé(e)</strong></p>
              <div class="signature-line">
                Signature et Date
              </div>
            </div>
            <div class="signature-box">
              <p><strong>Le Directeur</strong></p>
              <div class="signature-line">
                ${advance.approved_by_user?.full_name || 'Direction'}
                <br>Signature et Cachet
              </div>
              <div class="stamp-box">
                Cachet de l'entreprise
              </div>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Sahara Mobilier - Usine de Fabrication</p>
          <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        </div>
      </body>
      </html>
    `)
    
    printWindow.document.close()
    
    // Attendre que le contenu soit chargé puis imprimer
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  const numberToWords = (num) => {
    // Conversion simple du nombre en lettres (français)
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf']
    const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix']
    
    const n = Math.floor(num)
    if (n === 0) return 'zéro dirhams'
    
    // Conversion simplifiée pour les montants courants
    if (n < 1000) {
      return `${n} dirhams`
    }
    
    return `${n.toLocaleString()} dirhams`
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold flex items-center gap-1">
          <Clock className="w-3 h-3" /> En attente
        </span>
      case 'approved':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Approuvée
        </span>
      case 'rejected':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Rejetée
        </span>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  // Statistiques
  const pendingCount = advances.filter(a => a.status === 'pending').length
  const approvedCount = advances.filter(a => a.status === 'approved').length
  const totalApprovedAmount = advances
    .filter(a => a.status === 'approved')
    .reduce((sum, a) => sum + parseFloat(a.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Avances sur Salaire</h1>
          <p className="mt-2 text-sm text-gray-700">
            {isAdmin ? 'Gérer les demandes d\'avances' : 'Mes demandes d\'avances'}
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true)
            setError('')
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" />
          Nouvelle demande
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-yellow-50 rounded-xl shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 font-medium">En attente</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">{pendingCount}</p>
            </div>
            <Clock className="w-12 h-12 text-yellow-500" />
          </div>
        </div>

        <div className="bg-green-50 rounded-xl shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Approuvées</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{approvedCount}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Total approuvé</p>
              <p className="text-2xl font-bold text-blue-900 mt-2">
                {totalApprovedAmount.toLocaleString()} MAD
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Liste des avances */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(advance.request_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {advance.employees.first_name} {advance.employees.last_name}
                      </div>
                      <div className="text-xs text-gray-500">{advance.employees.employee_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-indigo-600">
                        {parseFloat(advance.amount).toLocaleString()} MAD
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {advance.reason || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(advance.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && advance.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(advance.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Approuver"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReject(advance.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Rejeter"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {advance.status === 'approved' && (
                          <button
                            onClick={() => printDocument(advance)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Imprimer"
                          >
                            <Printer className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Nouvelle demande d'avance
            </h2>
            
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreateAdvance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employé *
                </label>
                <select
                  value={newAdvance.employee_id}
                  onChange={(e) => setNewAdvance({ ...newAdvance, employee_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Sélectionner un employé</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_id} - {emp.first_name} {emp.last_name} ({emp.monthly_salary} MAD)
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
                  value={newAdvance.amount}
                  onChange={(e) => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                  required
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="500.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motif
                </label>
                <textarea
                  value={newAdvance.reason}
                  onChange={(e) => setNewAdvance({ ...newAdvance, reason: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Urgence familiale, frais médicaux, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setError('')
                    setNewAdvance({ employee_id: '', amount: '', reason: '' })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Créer la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
