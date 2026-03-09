import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Clock, Trophy, TrendingUp, Play, Pause, User as UserIcon } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PracticeSession } from "@/types/practice"

interface StudentInfo {
  id: number
  name: string
  email?: string | null
  role: string
  student_code?: string | null
  created_at?: string | null
}

interface StudentSessionsResponse {
  user: StudentInfo
  sessions: (PracticeSession & { has_audio?: boolean; practice_results?: Array<Record<string, unknown>> })[]
}

function MiniPlayer({ sessionId }: { sessionId: number }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioRef.current) {
      const token = localStorage.getItem("token")
      fetch(`/api/practice/session/${sessionId}/audio`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audio.addEventListener("ended", () => setPlaying(false))
          audioRef.current = audio
          audio.play()
          setPlaying(true)
        })
        .catch(() => {})
      return
    }
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <button onClick={toggle} className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer" title="Play recording">
      {playing ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-muted-foreground" />}
    </button>
  )
}

export default function StudentSessionsPage() {
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [sessions, setSessions] = useState<StudentSessionsResponse["sessions"]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!userId) return
    api.get<StudentSessionsResponse>(`/users/${userId}/sessions`)
      .then(data => {
        setStudent(data.user)
        setSessions(data.sessions)
      })
      .catch(err => setError(err.message || "Failed to load sessions"))
      .finally(() => setLoading(false))
  }, [userId])

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-amber-600"
    return "text-red-600"
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/students")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Students
          </Button>
          {student && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{student.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {student.student_code || student.email || "N/A"}
                  <Badge variant="secondary" className="ml-2">{student.role}</Badge>
                </p>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading sessions...</div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/students")}>
                Back to Students
              </Button>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium mb-2">No practice sessions</p>
              <p className="text-muted-foreground">This student hasn't completed any practice sessions yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</p>
            {sessions.map(session => {
              const practiceResult = session.practice_results?.[0]
              const overallScore = practiceResult?.overall_score as number | undefined
              const result = session.result as Record<string, unknown> | null
              const fallbackScore = result?.overall_score as number | undefined
              const displayScore = overallScore ?? fallbackScore

              return (
                <Card
                  key={session.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                  onClick={() => navigate(`/result/${session.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{session.exercise_title || "Free Practice"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {session.created_at ? new Date(session.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
                          }) : "N/A"}
                          {session.duration_seconds && (
                            <span>· {Math.round(session.duration_seconds)}s</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {session.has_audio && (
                        <MiniPlayer sessionId={session.id} />
                      )}
                      {displayScore !== undefined && (
                        <span className={`text-2xl font-bold ${getScoreColor(displayScore)}`}>
                          {displayScore}
                        </span>
                      )}
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
