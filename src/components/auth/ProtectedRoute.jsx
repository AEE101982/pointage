import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  console.log('🔷 ProtectedRoute render:', { hasUser: !!user, loading });

  if (loading) {
    console.log('⏳ Affichage du loader...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
          <p className="text-white text-lg font-semibold">Chargement...</p>
          <p className="text-white text-sm mt-2">Loading: {String(loading)}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('🚫 Pas d\'utilisateur, redirection vers /login');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ Utilisateur authentifié, affichage du contenu');
  return <Outlet />;
}
