import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, Zap, Hash, GraduationCap, Users, Activity,
  TrendingUp, Clock, BarChart3, Server,
} from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface TokenStats {
  total_tokens: number
  total_sessions: number
  total_students: number
  by_service: { service: string; total_tokens: number; request_count: number }[]
  recent_usage: { id: number; user_name: string; service: string; tokens_used: number; created_at: string | null }[]
}

function StatCard({ icon: Icon, label, value, gradient, sub }: {
  icon: React.ElementType; label: string; value: string | number; gradient: string; sub?: string
}) {
  return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminPanelPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [stats, setStats] = useState<TokenStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) {
      navigate("/")
      return
    }
    api.get<TokenStats>("/users/token-stats")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg pt-24 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const avgTokensPerSession =
    stats && stats.total_sessions > 0
      ? Math.round(stats.total_tokens / stats.total_sessions)
      : 0

  return (
    <div className="min-h-screen gradient-bg pt-24 pb-12 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">System overview and token usage analytics</p>
          </div>
        </div>

        {stats && (
          <>
            {/* === System Stats === */}
            <div className="mb-6">
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> System Overview
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={Zap}
                  label="Total Tokens Used"
                  value={stats.total_tokens.toLocaleString()}
                  gradient="bg-gradient-to-br from-amber-500 to-orange-500"
                />
                <StatCard
                  icon={Hash}
                  label="Total Practice Sessions"
                  value={stats.total_sessions.toLocaleString()}
                  gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
                />
                <StatCard
                  icon={GraduationCap}
                  label="Registered Students"
                  value={stats.total_students}
                  gradient="bg-gradient-to-br from-purple-500 to-pink-500"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Avg Tokens / Session"
                  value={avgTokensPerSession.toLocaleString()}
                  gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
                />
              </div>
            </div>

            {/* === Token Usage by Service === */}
            {stats.by_service.length > 0 && (
              <div className="mb-6">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" /> Token Usage by Service
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.by_service.map(s => (
                    <Card key={s.service} className="hover:shadow-md transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs">{s.service}</Badge>
                          <span className="text-xs text-muted-foreground">{s.request_count} requests</span>
                        </div>
                        <p className="text-xl font-bold">{s.total_tokens.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">tokens used</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* === Recent Token Usage === */}
            {stats.recent_usage.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Recent Token Usage
                  </CardTitle>
                  <CardDescription className="text-xs">Last 10 API calls with token consumption</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">User</th>
                          <th className="pb-2 font-medium">Service</th>
                          <th className="pb-2 font-medium text-right">Tokens</th>
                          <th className="pb-2 font-medium text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recent_usage.map(r => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 font-medium">{r.user_name}</td>
                            <td className="py-2.5">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.service}</span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-xs">{r.tokens_used?.toLocaleString()}</td>
                            <td className="py-2.5 text-right text-xs text-muted-foreground">
                              {r.created_at
                                ? new Date(r.created_at).toLocaleString("en-US", {
                                    month: "short", day: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                    timeZone: "Asia/Hong_Kong",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* === Quick Links === */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card
                className="cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
                onClick={() => navigate("/students")}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">User Management</p>
                    <p className="text-xs text-muted-foreground">Students & teacher accounts</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
                onClick={() => navigate("/exercises/manage")}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Exercise Management</p>
                    <p className="text-xs text-muted-foreground">Create and manage exercises</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
                onClick={() => navigate("/practice")}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Try Practice</p>
                    <p className="text-xs text-muted-foreground">Test student experience</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
