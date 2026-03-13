import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Brain, Headphones, Clock, Mic, CheckCircle, Loader2, Volume2, PlayCircle } from "lucide-react"
import { api } from "@/lib/api"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Exercise } from "@/types/exercise"

type Stage = "intro" | "listen" | "prepare" | "record" | "analyzing" | "result"

interface CRAAResult {
  session_id: number
  transcript: string
  overall_grade: number
  summary_score: number
  counterargument_score: number
  delivery_score: number
  overall_assessment: string
  summary_feedback: string
  counterargument_feedback: string
  delivery_feedback: string
  strengths: string[]
  areas_to_improve: string[]
  suggestions: string[]
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    let videoId: string | null = null
    if (u.hostname.includes("youtu.be")) {
      videoId = u.pathname.slice(1)
    } else if (u.hostname.includes("youtube.com")) {
      videoId = u.searchParams.get("v")
    }
    if (!videoId) return null
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
  } catch {
    return null
  }
}

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = seconds / total
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="absolute" width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="64" cy="64" r={radius} fill="none"
          stroke="hsl(var(--primary))" strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="text-center">
        <p className="text-3xl font-bold">{seconds}</p>
        <p className="text-xs text-muted-foreground">seconds</p>
      </div>
    </div>
  )
}

function ScoreDimension({ label, score, weight, feedback, color }: {
  label: string
  score: number
  weight: string
  feedback: string
  color: string
}) {
  const getGradeLabel = (s: number) => {
    if (s >= 85) return "Excellent"
    if (s >= 70) return "Good"
    if (s >= 55) return "Satisfactory"
    return "Needs Improvement"
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">{label}</h3>
            <p className="text-xs text-muted-foreground">{weight} of final grade</p>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-bold ${color}`}>{score}</span>
            <p className={`text-xs font-medium ${color}`}>{getGradeLabel(score)}</p>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mb-3">
          <div className={`h-2 rounded-full transition-all duration-700 ${
            score >= 70 ? "bg-green-500" : score >= 55 ? "bg-amber-500" : "bg-red-500"
          }`} style={{ width: `${score}%` }} />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{feedback}</p>
      </CardContent>
    </Card>
  )
}

export default function CRAAPracticePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const exerciseId = searchParams.get("exerciseId")

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [stage, setStage] = useState<Stage>("intro")
  const [prepCountdown, setPrepCountdown] = useState(0)
  const [recCountdown, setRecCountdown] = useState(0)
  const [result, setResult] = useState<CRAAResult | null>(null)
  const [error, setError] = useState("")
  const [isPlayingArgument, setIsPlayingArgument] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const argumentAudioRef = useRef<HTMLAudioElement | null>(null)

  const recorder = useAudioRecorder()

  useEffect(() => {
    if (!exerciseId) {
      navigate("/practice")
      return
    }
    api.get<Exercise>(`/exercises/${exerciseId}`)
      .then(ex => {
        if (ex.exercise_type !== "craa") {
          navigate("/practice")
          return
        }
        setExercise(ex)
        setPrepCountdown(ex.preparation_time ?? 120)
        setRecCountdown(ex.response_time ?? 120)
      })
      .catch(() => navigate("/practice"))
  }, [exerciseId])

  const playArgumentAudio = useCallback(() => {
    if (!exerciseId) return
    if (argumentAudioRef.current) {
      if (isPlayingArgument) {
        argumentAudioRef.current.pause()
        setIsPlayingArgument(false)
      } else {
        argumentAudioRef.current.play()
        setIsPlayingArgument(true)
      }
      return
    }
    setAudioLoading(true)
    const token = localStorage.getItem("token")
    fetch(`/api/exercises/${exerciseId}/argument-audio`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error("No audio")
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.addEventListener("ended", () => setIsPlayingArgument(false))
        argumentAudioRef.current = audio
        audio.play()
        setIsPlayingArgument(true)
      })
      .catch(() => {})
      .finally(() => setAudioLoading(false))
  }, [exerciseId, isPlayingArgument])

  // Countdown timer for prepare stage
  useEffect(() => {
    if (stage !== "prepare") return
    if (prepCountdown <= 0) {
      setStage("record")
      recorder.reset()
      recorder.startCountdown()
      return
    }
    const timer = setTimeout(() => setPrepCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [stage, prepCountdown])

  // Countdown timer for record stage
  useEffect(() => {
    if (stage !== "record") return
    if (recorder.state !== "recording") return
    if (recCountdown <= 0) {
      recorder.stopRecording()
      return
    }
    const timer = setTimeout(() => setRecCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [stage, recorder.state, recCountdown])

  // Submit when recording stops
  useEffect(() => {
    if (recorder.state === "stopped" && recorder.audioBlob && stage === "record") {
      submitCRAAResponse(recorder.audioBlob)
    }
  }, [recorder.state])

  const submitCRAAResponse = async (blob: Blob) => {
    setStage("analyzing")
    setError("")
    const formData = new FormData()
    formData.append("audio", blob, "craa_response.webm")
    formData.append("exercise_id", exerciseId!)

    try {
      const data = await api.upload<CRAAResult>("/practice/craa-analyze", formData)
      setResult(data)
      setStage("result")
    } catch (err: any) {
      setError(err.message || "Analysis failed")
      setStage("record")
    }
  }

  const getScoreColor = (s: number) =>
    s >= 70 ? "text-green-600" : s >= 55 ? "text-amber-600" : "text-red-600"

  if (!exercise) {
    return (
      <div className="min-h-screen gradient-bg pt-20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/practice")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">CRAA Practice</h1>
            <Badge variant="default">CRAA</Badge>
          </div>
        </div>

        {/* INTRO */}
        {stage === "intro" && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-2">{exercise.title}</h2>
                <p className="text-muted-foreground mb-4">{exercise.description}</p>

                {exercise.topic_context && (
                  <div className="mb-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1">Topic Context</p>
                    <p className="text-sm leading-relaxed">{exercise.topic_context}</p>
                  </div>
                )}

                {exercise.key_claim && (
                  <div className="mb-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase mb-1">Key Claim</p>
                    <p className="text-sm font-medium leading-relaxed">"{exercise.key_claim}"</p>
                  </div>
                )}

                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Prepare: {exercise.preparation_time ?? 120}s
                  </span>
                  <span className="flex items-center gap-1">
                    <Mic className="h-4 w-4" />
                    Respond: {exercise.response_time ?? 120}s
                  </span>
                </div>
              </CardContent>
            </Card>

            {exercise.video_url && (() => {
              const embedUrl = getYouTubeEmbedUrl(exercise.video_url)
              return embedUrl ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <PlayCircle className="h-4 w-4 text-red-500" />
                      <h3 className="font-semibold text-sm">Background Video</h3>
                    </div>
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        className="absolute inset-0 w-full h-full rounded-lg"
                        src={embedUrl}
                        title="Background video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null
            })()}

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">What you'll do:</h3>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">1</span><span><strong>Listen</strong> to an academic argument</span></li>
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">2</span><span><strong>Prepare</strong> your response ({exercise.preparation_time ?? 120}s countdown)</span></li>
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">3</span><span><strong>Record</strong> your critical response ({exercise.response_time ?? 120}s limit)</span></li>
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">4</span><span><strong>Receive</strong> AI feedback across 3 dimensions</span></li>
                </ol>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full" onClick={() => setStage("listen")}>
              <Headphones className="h-4 w-4 mr-2" /> Start — Listen to Argument
            </Button>
          </div>
        )}

        {/* LISTEN */}
        {stage === "listen" && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <Headphones className="h-16 w-16 mx-auto text-primary" />
              <h2 className="text-xl font-bold">Listen to the Argument</h2>

              {exercise.argument_text && (
                <div className="text-left p-4 rounded-lg bg-muted/50 max-h-64 overflow-y-auto">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Argument Text</p>
                  <p className="text-sm leading-relaxed">{exercise.argument_text}</p>
                </div>
              )}

              {exercise.has_argument_audio && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={playArgumentAudio}
                  disabled={audioLoading}
                >
                  {audioLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Volume2 className="h-4 w-4 mr-2" />
                  )}
                  {isPlayingArgument ? "Pause Audio" : "Play Argument Audio"}
                </Button>
              )}

              <p className="text-sm text-muted-foreground">
                Read or listen to the argument above, then click below to begin your preparation time.
              </p>

              <Button size="lg" className="w-full" onClick={() => {
                if (argumentAudioRef.current) argumentAudioRef.current.pause()
                setIsPlayingArgument(false)
                setPrepCountdown(exercise.preparation_time ?? 120)
                setStage("prepare")
              }}>
                <Clock className="h-4 w-4 mr-2" /> I'm Ready — Start Preparation Time
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PREPARE */}
        {stage === "prepare" && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <h2 className="text-xl font-bold">Preparation Time</h2>
              <p className="text-muted-foreground">Use this time to organise your thoughts. Recording will begin automatically.</p>
              <CountdownRing seconds={prepCountdown} total={exercise.preparation_time ?? 120} />
              <div className="text-left p-4 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Key Claim to Respond To</p>
                <p className="text-sm font-medium">"{exercise.key_claim}"</p>
              </div>
              <p className="text-sm text-muted-foreground">Tip: Plan to briefly <strong>summarize</strong> the argument, then provide your <strong>counterargument</strong>.</p>
            </CardContent>
          </Card>
        )}

        {/* RECORD */}
        {stage === "record" && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <h2 className="text-xl font-bold">Recording Your Response</h2>
              <CountdownRing seconds={recCountdown} total={exercise.response_time ?? 120} />
              {recorder.state === "idle" || recorder.state === "countdown" ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Starting microphone...</p>
                </div>
              ) : recorder.state === "recording" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-medium text-red-500">Recording</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Speak clearly. Recording stops automatically when time runs out.</p>
                  <Button variant="destructive" onClick={() => recorder.stopRecording()}>
                    Stop Recording Early
                  </Button>
                </div>
              ) : null}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {/* ANALYZING */}
        {stage === "analyzing" && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <Brain className="h-12 w-12 mx-auto text-primary animate-pulse" />
              <h2 className="text-xl font-bold">Analyzing Your Response</h2>
              <div className="space-y-3 max-w-xs mx-auto text-left">
                {[
                  "Transcribing speech...",
                  "Evaluating summary accuracy...",
                  "Assessing counterargument...",
                  "Scoring verbal delivery...",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* RESULT */}
        {stage === "result" && result && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 text-center">
                <Brain className="h-10 w-10 mx-auto text-primary mb-3" />
                <h2 className="text-xl font-bold mb-1">CRAA Assessment</h2>
                <p className="text-muted-foreground text-sm mb-4">{exercise.title}</p>
                <div className="text-6xl font-bold mb-1">
                  <span className={getScoreColor(result.overall_grade)}>{Math.round(result.overall_grade)}</span>
                  <span className="text-xl text-muted-foreground">/100</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Overall Grade</p>
                <div className="flex justify-center gap-6 text-center">
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(result.summary_score)}`}>{result.summary_score}</p>
                    <p className="text-xs text-muted-foreground">Summary (40%)</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(result.counterargument_score)}`}>{result.counterargument_score}</p>
                    <p className="text-xs text-muted-foreground">Counter (30%)</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(result.delivery_score)}`}>{result.delivery_score}</p>
                    <p className="text-xs text-muted-foreground">Delivery (30%)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-2">Overall Assessment</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{result.overall_assessment}</p>
              </CardContent>
            </Card>

            <ScoreDimension
              label="Summary Accuracy"
              score={result.summary_score}
              weight="40%"
              feedback={result.summary_feedback}
              color={getScoreColor(result.summary_score)}
            />
            <ScoreDimension
              label="Counterargument Quality"
              score={result.counterargument_score}
              weight="30%"
              feedback={result.counterargument_feedback}
              color={getScoreColor(result.counterargument_score)}
            />
            <ScoreDimension
              label="Verbal Delivery"
              score={result.delivery_score}
              weight="30%"
              feedback={result.delivery_feedback}
              color={getScoreColor(result.delivery_score)}
            />

            {result.strengths.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-green-600 mb-3">Strengths</h3>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm"><CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />{s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result.areas_to_improve.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3">Areas to Improve</h3>
                  <ul className="space-y-1">
                    {result.areas_to_improve.map((a, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {a}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result.suggestions.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3">Suggestions</h3>
                  <ul className="space-y-1">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result.transcript && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-2">Your Response (Transcript)</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">"{result.transcript}"</p>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={() => {
                setPrepCountdown(exercise.preparation_time ?? 120)
                setRecCountdown(exercise.response_time ?? 120)
                setResult(null)
                setError("")
                recorder.reset()
                setStage("intro")
              }}>Try Again</Button>
              <Button variant="outline" onClick={() => navigate("/practice")}>Back to Practice</Button>
              <Button variant="outline" onClick={() => navigate("/history")}>View History</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
