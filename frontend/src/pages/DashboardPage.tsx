import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Mic, BarChart3, Clock, BookOpen, Users, Settings, Zap, Hash, GraduationCap } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { api } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

interface TokenStats {
  total_tokens: number
  total_sessions: number
  total_students: number
  by_service: { service: string; total_tokens: number; request_count: number }[]
  recent_usage: { id: number; user_name: string; service: string; tokens_used: number; created_at: string | null }[]
}

function FeatureCard({ icon: Icon, title, description, gradient, onClick }: {
  icon: React.ElementType; title: string; description: string; gradient: string; onClick: () => void
}) {
  return (
    <Card
      className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 group overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg mb-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  )
}

function StatCard({ icon: Icon, label, value, gradient }: {
  icon: React.ElementType; label: string; value: string | number; gradient: string
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg ${gradient} flex items-center justify-center shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user, isTeacher, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)

  useEffect(() => {
    if (isTeacher) {
      api.get<TokenStats>("/users/token-stats").then(setTokenStats).catch(console.error)
    }
  }, [isTeacher])

  return (
    <div className="min-h-screen gradient-bg pt-24 pb-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">
            Welcome, <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {user?.role === "student" && user?.student_code ? user.student_code : user?.name}
            </span>
          </h1>
          <p className="text-muted-foreground">
            {isTeacher
              ? "Manage exercises and monitor student progress"
              : "Practice your English speaking skills with AI-powered feedback"
            }
          </p>
        </div>

        {!isTeacher ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={Mic}
              title="Start Practice"
              description="Choose an exercise and practice your English speaking with real-time AI feedback"
              gradient="bg-gradient-to-br from-blue-600 to-blue-500"
              onClick={() => navigate("/practice")}
            />
            <FeatureCard
              icon={Clock}
              title="Practice History"
              description="Review your past practice sessions and track your improvement over time"
              gradient="bg-gradient-to-br from-purple-600 to-purple-500"
              onClick={() => navigate("/history")}
            />
            <FeatureCard
              icon={BarChart3}
              title="My Progress"
              description="View detailed analytics of your speaking performance and progress trends"
              gradient="bg-gradient-to-br from-emerald-600 to-emerald-500"
              onClick={() => navigate("/history")}
            />
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            {tokenStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <StatCard
                  icon={Zap}
                  label="Total Tokens Used"
                  value={tokenStats.total_tokens.toLocaleString()}
                  gradient="bg-gradient-to-br from-amber-500 to-orange-500"
                />
                <StatCard
                  icon={Hash}
                  label="Total Practice Sessions"
                  value={tokenStats.total_sessions}
                  gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
                />
                <StatCard
                  icon={GraduationCap}
                  label="Registered Students"
                  value={tokenStats.total_students}
                  gradient="bg-gradient-to-br from-purple-500 to-pink-500"
                />
              </div>
            )}

            {/* Recent Token Usage */}
            {tokenStats && tokenStats.recent_usage.length > 0 && (
              <Card className="mb-8">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Recent Token Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tokenStats.recent_usage.slice(0, 5).map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.user_name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.service}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs">{r.tokens_used?.toLocaleString()} tokens</span>
                          <span className="text-xs text-muted-foreground">
                            {r.created_at ? new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Hong_Kong" }) : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FeatureCard
                icon={BookOpen}
                title="Exercise Management"
                description="Create, edit, and manage speaking exercises for your students"
                gradient="bg-gradient-to-br from-blue-600 to-blue-500"
                onClick={() => navigate("/exercises/manage")}
              />
              <FeatureCard
                icon={Users}
                title="Student Management"
                description="View all registered students and their practice performance data"
                gradient="bg-gradient-to-br from-purple-600 to-purple-500"
                onClick={() => navigate("/students")}
              />
              {isAdmin && (
                <FeatureCard
                  icon={Settings}
                  title="Admin Panel"
                  description="Register new teachers and manage system-wide settings"
                  gradient="bg-gradient-to-br from-rose-600 to-rose-500"
                  onClick={() => navigate("/students")}
                />
              )}
              <FeatureCard
                icon={Mic}
                title="Try Practice"
                description="Test exercises yourself to see what students will experience"
                gradient="bg-gradient-to-br from-emerald-600 to-emerald-500"
                onClick={() => navigate("/practice")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
