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
        // Appeler fetchUserRole mais ne pas bloquer
        fetchUserRole(session.user.email).finally(() => {
          console.log('🟢 Loading terminé (onAuthStateChange)')
          setLoading(false)
        })
      } else {
        setRole(null)
        setLoading(false)
      }
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
        // ✅ TOUJOURS terminer le loading même si fetchUserRole échoue
        await fetchUserRole(session.user.email).finally(() => {
          console.log('🟢 Loading terminé (checkSession)')
          setLoading(false)
        })
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
    console.log('🔵 FetchUserRole: Début pour', email)
    
    try {
      // Timeout de 2 secondes
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      )
      
      const fetchPromise = supabase
        .from('users')
        .select('role')
        .eq('email', email)
        .single()
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise])
      
      if (error) {
        console.warn('⚠️ Erreur récupération rôle:', error.message)
        console.log('🟡 Utilisation du rôle par défaut: admin')
        setRole('admin')
        return
      }
      
      if (data) {
        console.log('🟢 Rôle récupéré:', data.role)
        setRole(data.role)
      } else {
        console.log('🟡 Aucun rôle trouvé, utilisation du rôle par défaut')
        setRole('admin')
      }
      
    } catch (error) {
      console.error('❌ Exception fetchUserRole:', error.message)
      console.log('🟡 Utilisation du rôle par défaut: admin')
      setRole('admin')
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
      
      // Ne pas bloquer la connexion sur fetchUserRole
      if (data.user) {
        fetchUserRole(data.user.email).catch(err => {
          console.warn('Erreur fetchUserRole (non bloquant):', err)
        })
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
