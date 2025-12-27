import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null)

  useEffect(() => {
    console.log('🔵 AuthProvider: Initialisation')
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('🟢 AuthStateChange:', _event, session?.user?.email)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchUserRole(session.user.email)
      } else {
        setRole(null)
      }
      
      console.log('🟢 Loading terminé (onAuthStateChange)')
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkSession = async () => {
    try {
      console.log('🔵 CheckSession: Début')
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('❌ Erreur de session:', error)
        setLoading(false)
        return
      }

      console.log('🟢 Session trouvée:', session?.user?.email || 'Aucune session')
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchUserRole(session.user.email)
      } else {
        console.log('🟡 Pas de session, loading = false')
        setLoading(false)
      }
      
    } catch (error) {
      console.error('❌ Exception checkSession:', error)
      setLoading(false)
    }
  }

  const fetchUserRole = async (email) => {
    try {
      console.log('🔵 FetchUserRole: Début pour', email)
      
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('email', email)
        .single()
      
      if (error) {
        console.error('⚠️ Erreur récupération rôle (NON BLOQUANT):', error)
        // ✅ NE PAS BLOQUER - Continuer même sans rôle
        setRole('user') // Rôle par défaut
        setLoading(false)
        return
      }
      
      if (data) {
        console.log('🟢 Rôle récupéré:', data.role)
        setRole(data.role)
      } else {
        console.log('⚠️ Aucun rôle trouvé, utilisation du rôle par défaut')
        setRole('user')
      }
      
      console.log('🟢 Loading terminé (fetchUserRole)')
      setLoading(false)
      
    } catch (error) {
      console.error('❌ Exception fetchUserRole:', error)
      setRole('user') // Rôle par défaut en cas d'erreur
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      console.log('🔵 SignIn: Tentative pour', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('❌ Erreur signIn:', error)
        return { data: null, error }
      }

      console.log('🟢 SignIn réussi')
      if (data.user) {
        await fetchUserRole(data.user.email)
      }

      return { data, error: null }
    } catch (error) {
      console.error('❌ Exception signIn:', error)
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      console.log('🔵 SignOut: Début')
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Erreur signOut:', error)
        return { error }
      }

      setUser(null)
      setRole(null)
      console.log('🟢 SignOut réussi')
      
      return { error: null }
    } catch (error) {
      console.error('❌ Exception signOut:', error)
      return { error }
    }
  }

  const value = {
    user,
    role,
    loading,
    signIn,
    signOut
  }

  console.log('📊 État actuel:', { 
    hasUser: !!user, 
    role, 
    loading,
    email: user?.email 
  })

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider')
  }
  return context
}
