import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Mic, GraduationCap, BookOpen, BarChart3, ClipboardList,
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight,
  CheckCircle, Copy, User, KeyRound, Lock, Send, Clock
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ThemeToggle"

// ==================== Intro Carousel (from Replit) ====================
const slides = [
  {
    icon: Mic,
    headline: "Practice Speaking with AI Feedback",
    description: "Record yourself speaking and receive instant, detailed feedback powered by AI.",
  },
  {
    icon: BarChart3,
    headline: "Track Your Progress Over Time",
    description: "See how your speaking skills improve with detailed analytics and progress charts.",
  },
  {
    icon: ClipboardList,
    headline: "Assigned Exercises from Your Teacher",
    description: "Complete speaking exercises assigned by your teacher and get graded automatically.",
  },
  {
    icon: GraduationCap,
    headline: "Built for HKBU Students & Teachers",
    description: "Designed specifically for the HKBU community with AI-driven insights.",
  },
]

function IntroCarousel() {
  const [current, setCurrent] = useState(0)
  const next = useCallback(() => setCurrent((p) => (p + 1) % slides.length), [])
  const prev = useCallback(() => setCurrent((p) => (p - 1 + slides.length) % slides.length), [])
  useEffect(() => { const t = setInterval(next, 4000); return () => clearInterval(t) }, [next])
  const slide = slides[current]
  const Icon = slide.icon

  return (
    <div className="flex flex-col items-center text-center px-6 py-6">
      <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg mb-4">
        <Icon className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-lg font-bold mb-2 text-foreground min-h-[1.5em]">{slide.headline}</h2>
      <p className="text-muted-foreground text-xs leading-relaxed max-w-sm min-h-[2.5em]">{slide.description}</p>
      <div className="flex items-center gap-3 mt-4">
        <button onClick={prev} className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === current ? "w-5 bg-blue-600 dark:bg-blue-400" : "w-1.5 bg-muted-foreground/30"}`} />
          ))}
        </div>
        <button onClick={next} className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

// ==================== Step Dot ====================
function StepDot({ active, done }: { active?: boolean; done?: boolean }) {
  return <div className={`w-3 h-3 rounded-full transition-all ${done ? "bg-green-500" : active ? "bg-primary scale-125" : "bg-muted-foreground/30"}`} />
}

// ==================== Screens ====================
type Screen =
  | "welcome" | "student-choice" | "student-login"
  | "register-step1" | "register-step2" | "register-step3" | "register-done"
  | "teacher-login" | "teacher-request"

export default function LoginPage() {
  const [screen, setScreen] = useState<Screen>("welcome")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  const [studentCode, setStudentCode] = useState("")
  const [regDigits, setRegDigits] = useState("")
  const [regInitials, setRegInitials] = useState("")
  const [regSection, setRegSection] = useState("")
  const [generatedCode, setGeneratedCode] = useState("")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [reqName, setReqName] = useState("")
  const [reqEmail, setReqEmail] = useState("")
  const [reqPassword, setReqPassword] = useState("")
  const [reqReason, setReqReason] = useState("")

  const { loginStudent, registerStudent, loginTeacher, requestTeacherAccess } = useAuth()
  const navigate = useNavigate()
  const clearError = () => { setError(""); setSuccessMsg("") }

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentCode.trim()) { setError("Please enter your Student ID"); return }
    clearError(); setLoading(true)
    try { await loginStudent(studentCode.trim()); navigate("/") }
    catch (err: any) { setError(err.message || "Login failed") }
    finally { setLoading(false) }
  }

  const goStep2 = () => {
    if (!/^\d{4}$/.test(regDigits)) { setError("Please enter exactly 4 digits"); return }
    clearError(); setScreen("register-step2")
  }
  const goStep3 = () => {
    if (!/^[A-Za-z]{1,4}$/.test(regInitials.trim())) { setError("Please enter your initials (1-4 letters)"); return }
    clearError(); setScreen("register-step3")
  }
  const finishRegistration = async () => {
    clearError(); setLoading(true)
    try {
      const result = await registerStudent(regDigits, regInitials.trim(), regSection.trim() || undefined)
      setGeneratedCode(result.code); setScreen("register-done")
    } catch (err: any) { setError(err.message || "Registration failed") }
    finally { setLoading(false) }
  }

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields"); return }
    clearError(); setLoading(true)
    try { await loginTeacher(email.trim(), password); navigate("/") }
    catch (err: any) { setError(err.message || "Login failed") }
    finally { setLoading(false) }
  }

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqName.trim() || !reqEmail.trim() || !reqPassword.trim()) { setError("Please fill in all required fields"); return }
    clearError(); setLoading(true)
    try {
      await requestTeacherAccess(reqName.trim(), reqEmail.trim(), reqPassword, reqReason.trim() || undefined)
      setSuccessMsg("Your access request has been submitted! An administrator will review it shortly.")
    } catch (err: any) { setError(err.message || "Request failed") }
    finally { setLoading(false) }
  }

  const Wrapper = ({ children, showBack, onBack }: { children: React.ReactNode; showBack?: boolean; onBack?: () => void }) => (
    <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-md flex flex-col gap-4">
        {screen === "welcome" && (
          <Card className="glass shadow-2xl overflow-hidden">
            <div className="text-center pt-4 pb-1">
              <h1 className="text-xl font-bold text-foreground">AI Speech Coach</h1>
              <p className="text-xs text-muted-foreground mt-0.5">AI-powered speech practice for HKBU</p>
            </div>
            <IntroCarousel />
          </Card>
        )}
        <Card className="glass shadow-xl">
          {showBack && (
            <div className="px-6 pt-4">
              <button onClick={() => { clearError(); onBack?.() }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </div>
          )}
          {children}
          <CardFooter className="justify-center pt-2 pb-4">
            <p className="text-xs text-muted-foreground">AI-powered speech practice platform for HKBU</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )

  // ==================== WELCOME ====================
  if (screen === "welcome") {
    return (
      <Wrapper>
        <CardHeader className="text-center pb-2 pt-5">
          <CardTitle className="text-lg">Get Started</CardTitle>
          <CardDescription className="text-xs">Choose your role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <Button variant="outline" size="lg" className="w-full h-14 justify-start gap-4 text-left"
            onClick={() => { clearError(); setScreen("student-choice") }}>
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
              <GraduationCap className="h-4 w-4 text-blue-600" />
            </div>
            <div><p className="font-semibold text-sm">Student</p><p className="text-xs text-muted-foreground">Practice speaking exercises</p></div>
          </Button>
          <Button variant="outline" size="lg" className="w-full h-14 justify-start gap-4 text-left"
            onClick={() => { clearError(); setScreen("teacher-login") }}>
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4 text-purple-600" />
            </div>
            <div><p className="font-semibold text-sm">Teacher / Staff</p><p className="text-xs text-muted-foreground">Manage exercises & students</p></div>
          </Button>
        </CardContent>
      </Wrapper>
    )
  }

  // ==================== STUDENT CHOICE ====================
  if (screen === "student-choice") {
    return (
      <Wrapper showBack onBack={() => setScreen("welcome")}>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
          </div>
          <CardTitle className="text-lg">Welcome, Student!</CardTitle>
          <CardDescription className="text-xs">Have you used this platform before?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="lg" className="w-full h-14 justify-start gap-4"
            onClick={() => { clearError(); setScreen("student-login") }}>
            <KeyRound className="h-5 w-5 text-green-600 shrink-0" />
            <div className="text-left"><p className="font-semibold text-sm">Welcome back</p><p className="text-xs text-muted-foreground">Sign in with your Student ID</p></div>
          </Button>
          <Button variant="outline" size="lg" className="w-full h-14 justify-start gap-4"
            onClick={() => { clearError(); setRegDigits(""); setRegInitials(""); setRegSection(""); setScreen("register-step1") }}>
            <User className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="text-left"><p className="font-semibold text-sm">I'm new here</p><p className="text-xs text-muted-foreground">Create your Student ID in 3 easy steps</p></div>
          </Button>
        </CardContent>
      </Wrapper>
    )
  }

  // ==================== STUDENT LOGIN ====================
  if (screen === "student-login") {
    return (
      <Wrapper showBack onBack={() => setScreen("student-choice")}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">Welcome Back!</CardTitle>
          <CardDescription className="text-xs">Enter your Student ID to sign in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-code">Student ID</Label>
              <Input id="student-code" placeholder="e.g., 6342-YD-A1" value={studentCode}
                onChange={e => setStudentCode(e.target.value.toUpperCase())} maxLength={20}
                className="text-center text-lg font-mono tracking-wider" />
              <p className="text-xs text-muted-foreground text-center">Format: Last 4 digits - Initials - Section</p>
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>
          </form>
        </CardContent>
      </Wrapper>
    )
  }

  // ==================== REGISTER STEP 1 ====================
  if (screen === "register-step1") {
    return (
      <Wrapper showBack onBack={() => setScreen("student-choice")}>
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2"><StepDot active /><StepDot /><StepDot /></div>
          <CardTitle className="text-lg">Step 1 of 3</CardTitle>
          <CardDescription className="text-xs">Enter the last 4 digits of your student number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="e.g., 6342" value={regDigits} autoFocus
            onChange={e => setRegDigits(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4}
            className="text-center text-2xl font-mono tracking-[0.3em]" />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button className="w-full" onClick={goStep2} disabled={regDigits.length !== 4}>Next <ArrowRight className="h-4 w-4 ml-2" /></Button>
        </CardContent>
      </Wrapper>
    )
  }

  // ==================== REGISTER STEP 2 ====================
  if (screen === "register-step2") {
    return (
      <Wrapper showBack onBack={() => { clearError(); setScreen("register-step1") }}>
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2"><StepDot done /><StepDot active /><StepDot /></div>
          <CardTitle className="text-lg">Step 2 of 3</CardTitle>
          <CardDescription className="text-xs">Enter your name initials (first + last name)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="e.g., YD" value={regInitials} autoFocus
            onChange={e => setRegInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} maxLength={4}
            className="text-center text-2xl font-mono tracking-[0.3em]" />
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Your ID so far</p>
            <p className="font-mono text-lg font-bold">{regDigits}-{regInitials || "??"}</p>
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button className="w-full" onClick={goStep3} disabled={!regInitials.trim()}>Next <ArrowRight className="h-4 w-4 ml-2" /></Button>
        </CardContent>
      </Wrapper>
    )
  }

  // ==================== REGISTER STEP 3 ====================
  if (screen === "register-step3") {
    return (
      <Wrapper showBack onBack={() => { clearError(); setScreen("register-step2") }}>
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2"><StepDot done /><StepDot done /><StepDot active /></div>
          <CardTitle className="text-lg">Step 3 of 3</CardTitle>
          <CardDescription className="text-xs">Enter your class section (optional)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="e.g., A1, B2 (optional)" value={regSection} autoFocus
            onChange={e => setRegSection(e.target.value.toUpperCase().slice(0, 5))} maxLength={5}
            className="text-center text-2xl font-mono tracking-wider" />
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Your Student ID will be</p>
            <p className="font-mono text-xl font-bold text-primary">{regDigits}-{regInitials}{regSection ? `-${regSection}` : ""}</p>
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button className="w-full" onClick={finishRegistration} disabled={loading}>
            {loading ? "Creating account..." : "Create My Account"}
          </Button>
        </CardContent>
      </Wrapper>
    )
  }

  // ==================== REGISTER DONE ====================
  if (screen === "register-done") {
    return (
      <Wrapper>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-2">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <CardTitle className="text-lg">You're All Set!</CardTitle>
          <CardDescription className="text-xs">Your Student ID has been created</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/5 border-2 border-primary/20 text-center">
            <p className="text-xs text-muted-foreground mb-2">Your Student ID</p>
            <p className="font-mono text-2xl font-bold text-primary tracking-wider">{generatedCode}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => navigator.clipboard.writeText(generatedCode)}>
              <Copy className="h-4 w-4" /> Copy ID
            </Button>
            <Button className="flex-1" onClick={() => navigate("/")}>Start Practicing</Button>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400"><strong>Important:</strong> Remember your Student ID! You'll need it to sign in next time.</p>
          </div>
        </CardContent>
      </Wrapper>
    )
  }

  // ==================== TEACHER LOGIN ====================
  if (screen === "teacher-login") {
    return (
      <Wrapper showBack onBack={() => setScreen("welcome")}>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
          </div>
          <CardTitle className="text-lg">Teacher Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex rounded-lg bg-muted p-1 mb-4">
            <button onClick={() => { clearError(); setScreen("teacher-login") }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium cursor-pointer bg-background shadow-sm text-foreground">
              <Lock className="h-3.5 w-3.5" /> Sign In
            </button>
            <button onClick={() => { clearError(); setScreen("teacher-request") }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
              <Send className="h-3.5 w-3.5" /> Request Access
            </button>
          </div>
          <form onSubmit={handleTeacherLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="teacher@hkbu.edu.hk" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>
          </form>
        </CardContent>
      </Wrapper>
    )
  }

  // ==================== TEACHER REQUEST ACCESS ====================
  if (screen === "teacher-request") {
    return (
      <Wrapper showBack onBack={() => setScreen("welcome")}>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
          </div>
          <CardTitle className="text-lg">Request Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex rounded-lg bg-muted p-1 mb-4">
            <button onClick={() => { clearError(); setScreen("teacher-login") }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
              <Lock className="h-3.5 w-3.5" /> Sign In
            </button>
            <button onClick={() => { clearError(); setScreen("teacher-request") }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium cursor-pointer bg-background shadow-sm text-foreground">
              <Send className="h-3.5 w-3.5" /> Request Access
            </button>
          </div>
          {successMsg ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">{successMsg}</p>
              <Button variant="outline" onClick={() => { clearError(); setScreen("teacher-login") }}>Go to Sign In</Button>
            </div>
          ) : (
            <form onSubmit={handleRequestAccess} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input placeholder="Dr. Jane Smith" value={reqName} onChange={e => setReqName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="jane.smith@hkbu.edu.hk" value={reqEmail} onChange={e => setReqEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" placeholder="Create a password" value={reqPassword} onChange={e => setReqPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Reason (optional)</Label>
                <Input placeholder="e.g., UE1 course instructor" value={reqReason} onChange={e => setReqReason(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Submitting..." : "Submit Request"}</Button>
            </form>
          )}
        </CardContent>
      </Wrapper>
    )
  }

  return null
}
