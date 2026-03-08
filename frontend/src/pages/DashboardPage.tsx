import { useNavigate } from "react-router-dom"
import { Mic, BarChart3, Clock, BookOpen, Users, Settings } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

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

export default function DashboardPage() {
  const { user, isTeacher, isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen gradient-bg pt-24 pb-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">
            Welcome, <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{user?.name}</span>
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
        )}
      </div>
    </div>
  )
}
