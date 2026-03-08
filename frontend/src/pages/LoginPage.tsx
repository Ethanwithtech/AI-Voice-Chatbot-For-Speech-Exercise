import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Mic, GraduationCap, BookOpen } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ThemeToggle"

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
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md glass shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg mb-4">
            <Mic className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">AI Speech Coach</CardTitle>
          <CardDescription>Practice and improve your English speaking skills</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex rounded-lg bg-muted p-1 mb-6">
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
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div className="space-y-2">
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
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" type="email" placeholder="teacher@hkbu.edu.hk"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
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

        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground">
            AI-powered speech practice platform for HKBU
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
