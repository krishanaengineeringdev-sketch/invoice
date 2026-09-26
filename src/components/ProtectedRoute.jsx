import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
  const { session, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F6] flex flex-col justify-center items-center p-6 text-[#36454F]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#36454F] flex items-center justify-center text-[#F2A104] font-black text-xl shadow-md">
            KE
          </div>
          <span className="font-bold text-lg text-[#36454F]">Krishna Engineering</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#5C7A99]">
          <Loader2 className="w-5 h-5 animate-spin text-[#F2A104]" />
          <span>Restoring Authentication Session...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
