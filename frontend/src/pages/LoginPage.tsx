import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Mic, GraduationCap, BookOpen, BarChart3, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ThemeToggle"

const slides = [
  {
    icon: Mic,
    headline: "Practice Speaking with AI Feedback",
    description: "Record yourself speaking and receive instant, detailed feedback powered by AI. Improve pronunciation, fluency, and confidence at your own pace.",
  },
  {
    icon: BarChart3,
    headline: "Track Your Progress Over Time",
    description: "See how your speaking skills improve with detailed analytics and progress charts. Set goals and celebrate milestones along the way.",
  },
  {
    icon: ClipboardList,
    headline: "Assigned Exercises from Your Teacher",
    description: "Complete speaking exercises assigned by your teacher and get graded automatically. Stay on track with structured practice sessions.",
  },
  {
    icon: GraduationCap,
    headline: "Built for HKBU Students & Teachers",
    description: "Designed specifically for the HKBU community. Teachers create assignments, students practice, and everyone benefits from AI-driven insights.",
  },
]

function IntroCarousel() {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length)
  }, [])

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length)
  }, [])

  useEffect(() => {
    const timer = setInterval(next, 4000)
    return () => clearInterval(timer)
  }, [next])

  const slide = slides[current]
  const Icon = slide.icon

  return (
    <div className="flex flex-col items-center text-center px-6 py-8">
      <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-lg mb-6">
        <Icon className="h-10 w-10 text-white" />
      </div>

      <h2 className="text-2xl font-bold mb-3 text-foreground min-h-[2em]">
        {slide.headline}
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-sm min-h-[3.5em]">
        {slide.description}
      </p>

      <div className="flex items-center gap-4 mt-8">
        <button
          onClick={prev}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                i === current
                  ? "w-6 bg-blue-600 dark:bg-blue-400"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [tab, setTab] = useState<"student" | "teacher">("student")
  const [studentCode, setStudentCode] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { loginStudent, loginTeacher } = useAuth()
  const navigate = useNavigate()

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentCode.trim()) {
      setError("Please enter your Student ID")
      return
    }
    setError("")
    setLoading(true)
    loginStudent(studentCode.trim())
      .then(() => navigate("/"))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields")
      return
    }
    setError("")
    setLoading(true)
    loginTeacher(email.trim(), password)
      .then(() => navigate("/"))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">
        <Card className="glass shadow-2xl overflow-hidden">
          <div className="text-center pt-6 pb-2">
            <h1 className="text-2xl font-bold text-foreground">AI Speech Coach</h1>
            <p className="text-xs text-muted-foreground mt-1">AI-powered speech practice platform for HKBU</p>
          </div>
          <IntroCarousel />
        </Card>

        <Card className="glass shadow-xl">
          <CardHeader className="text-center pb-2 pt-5">
            <CardTitle className="text-lg font-semibold">Sign In</CardTitle>
            <CardDescription className="text-xs">Choose your role to get started</CardDescription>
          </CardHeader>

          <CardContent className="pb-4">
            <div className="flex rounded-lg bg-muted p-1 mb-4">
              <button
                onClick={() => { setTab("student"); setError("") }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  tab === "student" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                Student
              </button>
              <button
                onClick={() => { setTab("teacher"); setError("") }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  tab === "teacher" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Teacher
              </button>
            </div>

            {tab === "student" ? (
              <form onSubmit={handleStudentLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="student-code">Student ID</Label>
                  <Input
                    id="student-code"
                    placeholder="e.g., JS123456"
                    value={studentCode}
                    onChange={e => setStudentCode(e.target.value.toUpperCase())}
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: First name initial + Last name initial + Last 4 digits of student number + 2 random digits
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In as Student"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleTeacherLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email" type="email" placeholder="teacher@hkbu.edu.hk"
                    value={email} onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password" type="password" placeholder="Enter your password"
                    value={password} onChange={e => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In as Teacher"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
