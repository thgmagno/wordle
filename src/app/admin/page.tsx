/**
 * Admin Dashboard Page
 *
 * /admin
 * Dashboard para monitorar métricas do jogo
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin-dashboard";

/**
 * Admin page - requer autenticação como admin
 */
export default async function AdminPage() {
  const session = await auth();

  // Verificar autenticação
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // TODO: Verificar se usuário é admin
  // Por enquanto, todos os usuários autenticados podem acessar
  // Em produção, adicionar verificação de role/permission

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Monitore métricas e performance do jogo
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminDashboard />
      </div>

      {/* Info Box */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>📊 Dashboard Info:</strong> Métricas são atualizadas a cada 30 segundos.
            Para informações detalhadas, verifique os logs ou integre com ferramentas como
            Sentry, DataDog, ou Vercel Analytics.
          </p>
        </div>
      </div>
    </div>
  );
}
