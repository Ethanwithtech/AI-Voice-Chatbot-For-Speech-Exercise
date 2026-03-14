import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Mic, GraduationCap, BookOpen, ArrowLeft, ArrowRight,
  CheckCircle, Copy, User, KeyRound, Mail, Lock, Send
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card, CardHeader, CardTitle, CardDescription,
  CardContent, CardFooter
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/ThemeToggle"

type Screen =
  | "welcome"          // Choose Teacher or Student
  | "student-choice"   // Welcome back (login) or I'm new here (register)
  | "student-login"    // Login with unique ID
  | "register-step1"   // Last 4 digits of student ID
  | "register-step2"   // Name initials
  | "register-step3"   // Section (optional)
  | "register-done"    // Show generated ID
  | "teacher-login"    // Teacher sign in
  | "teacher-request"  // Teacher request access

export default function LoginPage() {
  const [screen, setScreen] = useState<Screen>("welcome")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  // Student login
  const [studentCode, setStudentCode] = useState("")

  // Student registration
  const [regDigits, setRegDigits] = useState("")
  const [regInitials, setRegInitials] = useState("")
  const [regSection, setRegSection] = useState("")
  const [generatedCode, setGeneratedCode] = useState("")

  // Teacher login
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Teacher request access
  const [reqName, setReqName] = useState("")
  const [reqEmail, setReqEmail] = useState("")
  const [reqPassword, setReqPassword] = useState("")
  const [reqReason, setReqReason] = useState("")

  const { loginStudent, registerStudent, loginTeacher, requestTeacherAccess } = useAuth()
  const navigate = useNavigate()

  const clearError = () => { setError(""); setSuccessMsg("") }

  // --- Student Login ---
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentCode.trim()) { setError("Please enter your Student ID"); return }
    clearError()
    setLoading(true)
    try {
      await loginStudent(studentCode.trim())
      navigate("/")
    } catch (err: any) {
      setError(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  // --- Student Registration Step 1 → 2 → 3 → Done ---
  const goStep2 = () => {
    if (!regDigits || regDigits.length !== 4 || !/^\d{4}$/.test(regDigits)) {
      setError("Please enter exactly 4 digits"); return
    }
    clearError(); setScreen("register-step2")
  }

  const goStep3 = () => {
    if (!regInitials.trim() || !/^[A-Za-z]{1,4}$/.test(regInitials.trim())) {
      setError("Please enter your initials (1-4 letters)"); return
    }
    clearError(); setScreen("register-step3")
  }

  const finishRegistration = async () => {
    clearError()
    setLoading(true)
    try {
      const result = await registerStudent(regDigits, regInitials.trim(), regSection.trim() || undefined)
      setGeneratedCode(result.code)
      setScreen("register-done")
    } catch (err: any) {
      setError(err.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  // --- Teacher Login ---
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields"); return }
    clearError()
    setLoading(true)
    try {
      await loginTeacher(email.trim(), password)
      navigate("/")
    } catch (err: any) {
      setError(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  // --- Teacher Request Access ---
  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqName.trim() || !reqEmail.trim() || !reqPassword.trim()) {
      setError("Please fill in all required fields"); return
    }
    clearError()
    setLoading(true)
    try {
      await requestTeacherAccess(reqName.trim(), reqEmail.trim(), reqPassword, reqReason.trim() || undefined)
      setSuccessMsg("Your access request has been submitted! An administrator will review it shortly.")
    } catch (err: any) {
      setError(err.message || "Request failed")
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode)
  }

  // --- Shared wrapper ---
  const Wrapper = ({ children, showBack, onBack }: { children: React.ReactNode; showBack?: boolean; onBack?: () => void }) => (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md glass shadow-2xl">
        {showBack && (
          <div className="px-6 pt-4">
            <button onClick={() => { clearError(); onBack?.() }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </div>
        )}
        {children}
        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground">AI-powered speech practice platform for HKBU</p>
        </CardFooter>
      </Card>
    </div>
  )

  // ======================== SCREENS ========================

  // --- WELCOME ---
  if (screen === "welcome") {
    return (
      <Wrapper>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg mb-4">
            <Mic className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">AI Speech Coach</CardTitle>
          <CardDescription>Practice and improve your English speaking skills</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-center text-muted-foreground font-medium mb-2">I am a...</p>
          <Button
            variant="outline" size="lg" className="w-full h-16 justify-start gap-4 text-left"
            onClick={() => { clearError(); setScreen("student-choice") }}
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold">Student</p>
              <p className="text-xs text-muted-foreground">Practice speaking exercises</p>
            </div>
          </Button>
          <Button
            variant="outline" size="lg" className="w-full h-16 justify-start gap-4 text-left"
            onClick={() => { clearError(); setScreen("teacher-login") }}
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold">Teacher / Staff</p>
              <p className="text-xs text-muted-foreground">Manage exercises & students</p>
            </div>
          </Button>
        </CardContent>
      </Wrapper>
    )
  }

  // --- STUDENT CHOICE ---
  if (screen === "student-choice") {
    return (
      <Wrapper showBack onBack={() => setScreen("welcome")}>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-3">
            <GraduationCap className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl font-bold">Welcome, Student!</CardTitle>
          <CardDescription>Have you used this platform before?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline" size="lg" className="w-full h-14 justify-start gap-4"
            onClick={() => { clearError(); setScreen("student-login") }}
          >
            <KeyRound className="h-5 w-5 text-green-600 shrink-0" />
            <div className="text-left">
              <p className="font-semibold text-sm">Welcome back</p>
              <p className="text-xs text-muted-foreground">Sign in with your Student ID</p>
            </div>
          </Button>
          <Button
            variant="outline" size="lg" className="w-full h-14 justify-start gap-4"
            onClick={() => { clearError(); setRegDigits(""); setRegInitials(""); setRegSection(""); setScreen("register-step1") }}
          >
            <User className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="text-left">
              <p className="font-semibold text-sm">I'm new here</p>
              <p className="text-xs text-muted-foreground">Create your Student ID in 3 easy steps</p>
            </div>
          </Button>
        </CardContent>
      </Wrapper>
    )
  }

  // --- STUDENT LOGIN ---
  if (screen === "student-login") {
    return (
      <Wrapper showBack onBack={() => setScreen("student-choice")}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-bold">Welcome Back!</CardTitle>
          <CardDescription>Enter your Student ID to sign in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-code">Student ID</Label>
              <Input
                id="student-code"
                placeholder="e.g., 6342-YD-A1"
                value={studentCode}
                onChange={e => setStudentCode(e.target.value.toUpperCase())}
                maxLength={20}
                className="text-center text-lg font-mono tracking-wider"
              />
              <p className="text-xs text-muted-foreground text-center">
                Format: Last 4 digits - Initials - Section
              </p>
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Wrapper>
    )
  }

  // --- REGISTER STEP 1: Last 4 digits ---
  if (screen === "register-step1") {
    return (
      <Wrapper showBack onBack={() => setScreen("student-choice")}>
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <StepDot active /><StepDot /><StepDot />
          </div>
          <CardTitle className="text-xl font-bold">Step 1 of 3</CardTitle>
          <CardDescription>Enter the last 4 digits of your student number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-digits">Last 4 Digits</Label>
            <Input
              id="reg-digits"
              placeholder="e.g., 6342"
              value={regDigits}
              onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setRegDigits(v) }}
              maxLength={4}
              className="text-center text-2xl font-mono tracking-[0.3em]"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button className="w-full" onClick={goStep2} disabled={regDigits.length !== 4}>
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Wrapper>
    )
  }

  // --- REGISTER STEP 2: Initials ---
  if (screen === "register-step2") {
    return (
      <Wrapper showBack onBack={() => { clearError(); setScreen("register-step1") }}>
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <StepDot done /><StepDot active /><StepDot />
          </div>
          <CardTitle className="text-xl font-bold">Step 2 of 3</CardTitle>
          <CardDescription>Enter your name initials (first + last name)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-initials">Your Initials</Label>
            <Input
              id="reg-initials"
              placeholder="e.g., YD (Yuchen Deng)"
              value={regInitials}
              onChange={e => setRegInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
              maxLength={4}
              className="text-center text-2xl font-mono tracking-[0.3em]"
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              First letter of your first name + first letter of your last name
            </p>
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Your ID so far</p>
            <p className="font-mono text-lg font-bold">{regDigits}-{regInitials || "???"}</p>
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button className="w-full" onClick={goStep3} disabled={!regInitials.trim()}>
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Wrapper>
    )
  }

  // --- REGISTER STEP 3: Section (optional) ---
  if (screen === "register-step3") {
    return (
      <Wrapper showBack onBack={() => { clearError(); setScreen("register-step2") }}>
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <StepDot done /><StepDot done /><StepDot active />
          </div>
          <CardTitle className="text-xl font-bold">Step 3 of 3</CardTitle>
          <CardDescription>Enter your class section (optional)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-section">Section</Label>
            <Input
              id="reg-section"
              placeholder="e.g., A1, B2 (optional)"
              value={regSection}
              onChange={e => setRegSection(e.target.value.toUpperCase().slice(0, 5))}
              maxLength={5}
              className="text-center text-2xl font-mono tracking-wider"
              autoFocus
            />
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Your Student ID will be</p>
            <p className="font-mono text-xl font-bold text-primary">
              {regDigits}-{regInitials}{regSection ? `-${regSection}` : ""}
            </p>
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button className="w-full" onClick={finishRegistration} disabled={loading}>
            {loading ? "Creating account..." : "Create My Account"}
          </Button>
        </CardContent>
      </Wrapper>
    )
  }

  // --- REGISTER DONE ---
  if (screen === "register-done") {
    return (
      <Wrapper>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-xl font-bold">You're All Set!</CardTitle>
          <CardDescription>Your Student ID has been created</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/5 border-2 border-primary/20 text-center">
            <p className="text-xs text-muted-foreground mb-2">Your Student ID</p>
            <p className="font-mono text-2xl font-bold text-primary tracking-wider">{generatedCode}</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={copyCode}>
              <Copy className="h-4 w-4" /> Copy ID
            </Button>
            <Button className="flex-1" onClick={() => navigate("/")}>
              Start Practicing
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Important:</strong> Remember your Student ID! You'll need it to sign in next time.
            </p>
          </div>
        </CardContent>
      </Wrapper>
    )
  }

  // --- TEACHER LOGIN ---
  if (screen === "teacher-login") {
    return (
      <Wrapper showBack onBack={() => setScreen("welcome")}>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-3">
            <BookOpen className="h-6 w-6 text-purple-600" />
          </div>
          <CardTitle className="text-xl font-bold">Teacher Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Tabs: Sign In / Request Access */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              onClick={() => { clearError(); setScreen("teacher-login") }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer bg-background shadow-sm text-foreground"
            >
              <Lock className="h-3.5 w-3.5" /> Sign In
            </button>
            <button
              onClick={() => { clearError(); setScreen("teacher-request") }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <Send className="h-3.5 w-3.5" /> Request Access
            </button>
          </div>

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
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Wrapper>
    )
  }

  // --- TEACHER REQUEST ACCESS ---
  if (screen === "teacher-request") {
    return (
      <Wrapper showBack onBack={() => setScreen("welcome")}>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-3">
            <BookOpen className="h-6 w-6 text-purple-600" />
          </div>
          <CardTitle className="text-xl font-bold">Request Access</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              onClick={() => { clearError(); setScreen("teacher-login") }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <Lock className="h-3.5 w-3.5" /> Sign In
            </button>
            <button
              onClick={() => { clearError(); setScreen("teacher-request") }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer bg-background shadow-sm text-foreground"
            >
              <Send className="h-3.5 w-3.5" /> Request Access
            </button>
          </div>

          {successMsg ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">{successMsg}</p>
              <Button variant="outline" onClick={() => { clearError(); setScreen("teacher-login") }}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRequestAccess} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="req-name">Full Name</Label>
                <Input
                  id="req-name" placeholder="Dr. Jane Smith"
                  value={reqName} onChange={e => setReqName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-email">Email</Label>
                <Input
                  id="req-email" type="email" placeholder="jane.smith@hkbu.edu.hk"
                  value={reqEmail} onChange={e => setReqEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-password">Password</Label>
                <Input
                  id="req-password" type="password" placeholder="Create a password"
                  value={reqPassword} onChange={e => setReqPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-reason">Reason (optional)</Label>
                <Input
                  id="req-reason" placeholder="e.g., UE1 course instructor"
                  value={reqReason} onChange={e => setReqReason(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          )}
        </CardContent>
      </Wrapper>
    )
  }

  return null
}

// --- Step Dot Component ---
function StepDot({ active, done }: { active?: boolean; done?: boolean }) {
  return (
    <div className={`w-3 h-3 rounded-full transition-all ${
      done ? "bg-green-500" :
      active ? "bg-primary scale-125" :
      "bg-muted-foreground/30"
    }`} />
  )
}
