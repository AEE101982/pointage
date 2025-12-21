import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(null)

  useEffect(() => {
    // Vérifier la session actuelle au chargement
    checkSession()

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchUserRole(session.user.email)
      } else {
        setRole(null)
      }
      
      setLoading(false)
    })

    // Nettoyer l'abonnement quand le composant est démonté
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Erreur de session:', error)
        setLoading(false)
        return
      }

      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchUserRole(session.user.email)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Erreur checkSession:', error)
      setLoading(false)
    }
  }

  const fetchUserRole = async (email) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('email', email)
        .single()
      
      if (error) {
        console.error('Erreur récupération rôle:', error)
        return
      }
      
      if (data) {
        setRole(data.role)
      }
    } catch (error) {
      console.error('Erreur fetchUserRole:', error)
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('Erreur signIn:', error)
        return { data: null, error }
      }

      // Récupérer le rôle immédiatement après connexion
      if (data.user) {
        await fetchUserRole(data.user.email)
      }

      return { data, error: null }
    } catch (error) {
      console.error('Exception signIn:', error)
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Erreur signOut:', error)
        return { error }
      }

      setUser(null)
      setRole(null)
      
      return { error: null }
    } catch (error) {
      console.error('Exception signOut:', error)
      return { error }
    }
  }

  return { 
    user, 
    role, 
    loading, 
    signIn, 
    signOut 
  }
}