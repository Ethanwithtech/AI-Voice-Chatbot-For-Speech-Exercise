import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Users, UserPlus, Eye, GraduationCap } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth, type User } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function StudentManagePage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [students, setStudents] = useState<User[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [tab, setTab] = useState<"students" | "teachers">("students")
  const [loading, setLoading] = useState(true)

  const [registerOpen, setRegisterOpen] = useState(false)
  const [regName, setRegName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setLoading(true)
    Promise.all([
      api.get<User[]>("/users/students"),
      isAdmin ? api.get<User[]>("/users/teachers") : Promise.resolve([]),
    ])
      .then(([s, t]) => { setStudents(s); setTeachers(t) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegLoading(true)
    setRegError("")

    api.post("/auth/register", { name: regName, email: regEmail, password: regPassword })
      .then(() => {
        setRegisterOpen(false)
        setRegName("")
        setRegEmail("")
        setRegPassword("")
        loadData()
      })
      .catch(err => setRegError(err.message))
      .finally(() => setRegLoading(false))
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
            </Button>
            <h1 className="text-2xl font-bold">User Management</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => setRegisterOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Register Teacher
            </Button>
          )}
        </div>

        {isAdmin && (
          <div className="flex rounded-lg bg-muted p-1 mb-6 max-w-xs">
            <button
              onClick={() => setTab("students")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                tab === "students" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Students ({students.length})
            </button>
            <button
              onClick={() => setTab("teachers")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                tab === "teachers" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Users className="h-4 w-4" />
              Teachers ({teachers.length})
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3">
            {(tab === "students" ? students : teachers).map(user => (
              <Card key={user.id} className="hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.name}</p>
                        <Badge variant={user.role === "admin" ? "destructive" : "secondary"}>
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {user.email || user.student_code || "N/A"}
                        {user.created_at && ` · Joined ${new Date(user.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  {tab === "students" && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/students/${user.id}`)}>
                      <Eye className="h-4 w-4 mr-1" /> View Sessions
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}

            {(tab === "students" ? students : teachers).length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No {tab} found
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)}>
          <DialogHeader>
            <DialogTitle>Register New Teacher</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Teacher Name" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="teacher@hkbu.edu.hk" required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Set a password" required />
            </div>
            {regError && <p className="text-sm text-destructive">{regError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={regLoading}>
                {regLoading ? "Registering..." : "Register"}
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </div>
  )
}
