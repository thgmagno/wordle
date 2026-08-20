"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface DashboardMetrics {
  totalUsers: number;
  totalGames: number;
  avgPlayersPerGame: number;
  onlineUsers: number;
  gamesByWordLength: Record<number, number>;
  popularWords: Array<{ word: string; count: number }>;
  dailyGames: Array<{ date: string; count: number }>;
}

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

/**
 * Admin Dashboard Component
 * Mostra métricas e analytics do jogo
 */
export function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMetrics() {
    try {
      const response = await fetch("/api/admin/metrics");
      if (!response.ok) throw new Error("Failed to fetch metrics");
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to load dashboard metrics:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <p className="text-red-800">Failed to load dashboard metrics</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Users"
          value={metrics.totalUsers}
          icon="👥"
        />
        <MetricCard
          label="Total Games"
          value={metrics.totalGames}
          icon="🎮"
        />
        <MetricCard
          label="Avg Players/Game"
          value={metrics.avgPlayersPerGame.toFixed(1)}
          icon="👫"
        />
        <MetricCard
          label="Online Now"
          value={metrics.onlineUsers}
          icon="🟢"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Games by Word Length */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Games by Word Length</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={Object.entries(metrics.gamesByWordLength).map(([length, count]) => ({
                  name: `${length} letters`,
                  value: count,
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Games Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Games Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.dailyGames}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                name="Games"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Popular Words */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Popular Words</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={metrics.popularWords}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="word" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}
