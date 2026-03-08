import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Clock, Trophy, TrendingUp, Play, Pause, Volume2 } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PracticeSession } from "@/types/practice"

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

export default function HistoryPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PracticeSession[]>("/practice/history")
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-amber-600"
    return "text-red-600"
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Practice History</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium mb-2">No practice sessions yet</p>
              <p className="text-muted-foreground mb-4">Start practicing to see your history here</p>
              <Button onClick={() => navigate("/practice")}>Start Practice</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const result = session.result as Record<string, unknown> | null
              const overallScore = result?.overall_score as number | undefined

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
                      {(session as any).has_audio && (
                        <MiniPlayer sessionId={session.id} />
                      )}
                      {overallScore !== undefined && (
                        <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                          {overallScore}
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
