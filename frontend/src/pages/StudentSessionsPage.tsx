import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Clock, Trophy, TrendingUp, Play, Pause, Volume2, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { User } from "@/lib/auth"

interface SessionResult {
  id: number
  overall_score: number | null
  grammar_score: number | null
  fluency_score: number | null
  pronunciation_score: number | null
  prosody_score: number | null
  created_at: string | null
}

interface StudentSession {
  id: number
  student_id: number
  exercise_id: number | null
  transcript: string | null
  duration_seconds: number | null
  has_audio: boolean
  created_at: string | null
  practice_results: SessionResult[]
  exercise_title: string | null
}

interface SessionsResponse {
  user: User
  sessions: StudentSession[]
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
        .then(res => {
          if (!res.ok) throw new Error("No audio")
          return res.blob()
        })
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
    <button
      onClick={toggle}
      className="p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
      title="Play recording"
    >
      {playing ? <Pause className="h-4 w-4 text-primary" /> : <Volume2 className="h-4 w-4 text-muted-foreground" />}
    </button>
  )
}

export default function StudentSessionsPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<SessionsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    api.get<SessionsResponse>(`/users/${userId}/sessions`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-amber-600"
    return "text-red-600"
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg pt-20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/students")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {data?.user.name || "Student"}'s Sessions
            </h1>
            <p className="text-sm text-muted-foreground">
              {data?.user.student_code || data?.user.email || ""}
              {data?.sessions.length !== undefined && ` · ${data.sessions.length} sessions`}
            </p>
          </div>
        </div>

        {!data || data.sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium mb-2">No practice sessions yet</p>
              <p className="text-muted-foreground">This student hasn't completed any practice sessions</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.sessions.map(session => {
              const result = session.practice_results?.[0]
              const overallScore = result?.overall_score

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
                      {overallScore !== undefined && overallScore !== null && (
                        <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                          {Math.round(overallScore)}
                        </span>
                      )}
                      {result && (
                        <div className="hidden sm:flex gap-1">
                          {result.grammar_score !== null && (
                            <Badge variant="outline" className="text-[10px] px-1.5">G:{Math.round(result.grammar_score)}</Badge>
                          )}
                          {result.fluency_score !== null && (
                            <Badge variant="outline" className="text-[10px] px-1.5">F:{Math.round(result.fluency_score)}</Badge>
                          )}
                          {result.pronunciation_score !== null && (
                            <Badge variant="outline" className="text-[10px] px-1.5">P:{Math.round(result.pronunciation_score)}</Badge>
                          )}
                        </div>
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
