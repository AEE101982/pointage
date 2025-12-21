import { createClient } from '@supabase/supabase-js'

// Variables d'environnement
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug (à supprimer plus tard)
console.log('🔍 Supabase URL:', supabaseUrl)
console.log('🔍 Supabase Key:', supabaseAnonKey ? 'Présente ✅' : 'Absente ❌')

// Validation
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables manquantes!')
  console.error('URL:', supabaseUrl)
  console.error('Key:', supabaseAnonKey)
  throw new Error('Variables d\'environnement Supabase manquantes')
}

// Créer et exporter le client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('✅ Client Supabase initialisé')