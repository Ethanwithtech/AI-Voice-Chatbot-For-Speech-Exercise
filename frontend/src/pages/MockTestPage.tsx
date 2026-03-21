import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft, Brain, Headphones, Clock, Mic, CheckCircle, Loader2,
  Volume2, Play, Pause, AlertTriangle, FileText, Shield,
} from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Exercise } from "@/types/exercise"

type Stage = "select" | "rules" | "listen" | "prepare" | "record" | "analyzing" | "result"

interface CRAAResult {
  session_id: number
  transcript: string
  transcription_source?: "client" | "server"
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

function CountdownRing({ seconds, total, warn }: { seconds: number; total: number; warn?: boolean }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = seconds / total
  const dashOffset = circumference * (1 - progress)
  const isLow = seconds <= 30

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute" width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="72" cy="72" r={radius} fill="none"
          stroke={isLow && warn ? "hsl(0 72% 51%)" : "hsl(var(--primary))"}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 72 72)"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="text-center">
        <p className={`text-4xl font-bold ${isLow && warn ? "text-red-500 animate-pulse" : ""}`}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">remaining</p>
      </div>
    </div>
  )
}

function ScoreDimension({ label, score, weight, feedback, color }: {
  label: string; score: number; weight: string; feedback: string; color: string
}) {
  const getGradeLabel = (s: number) => {
    if (s >= 85) return "A"
    if (s >= 75) return "B+"
    if (s >= 65) return "B"
    if (s >= 55) return "C"
    return "D"
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

export default function MockTestPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const exerciseIdParam = searchParams.get("exerciseId")

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [stage, setStage] = useState<Stage>(exerciseIdParam ? "rules" : "select")
  const [prepCountdown, setPrepCountdown] = useState(0)
  const [recCountdown, setRecCountdown] = useState(0)
  const [result, setResult] = useState<CRAAResult | null>(null)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [isPlayingResult, setIsPlayingResult] = useState(false)
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null)

  const [audioStatus, setAudioStatus] = useState<"idle" | "loading" | "playing-narration" | "playing-argument" | "done">("idle")
  const [audioError, setAudioError] = useState("")
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null)
  const argumentAudioRef = useRef<HTMLAudioElement | null>(null)

  const recorder = useAudioRecorder()

  // Load exercises for selection
  useEffect(() => {
    if (!exerciseIdParam) {
      api.get<Exercise[]>("/exercises/")
        .then(all => setExercises(all.filter(e => e.exercise_type === "craa")))
        .catch(console.error)
    }
  }, [exerciseIdParam])

  // Load specific exercise
  useEffect(() => {
    const id = exerciseIdParam
    if (!id) return
    api.get<Exercise>(`/exercises/${id}`)
      .then(ex => {
        if (ex.exercise_type !== "craa") { navigate("/practice"); return }
        setExercise(ex)
        setPrepCountdown(ex.preparation_time ?? 120)
        setRecCountdown(ex.response_time ?? 120)
      })
      .catch(() => navigate("/practice"))
  }, [exerciseIdParam])

  const selectExercise = (ex: Exercise) => {
    setExercise(ex)
    setPrepCountdown(ex.preparation_time ?? 120)
    setRecCountdown(ex.response_time ?? 120)
    setStage("rules")
  }

  const fetchAudioBlob = useCallback(async (url: string): Promise<HTMLAudioElement> => {
    const token = localStorage.getItem("token")
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error("Audio unavailable")
    const blob = await res.blob()
    return new Audio(URL.createObjectURL(blob))
  }, [])

  const playArgumentAudio = useCallback((audioEl: HTMLAudioElement) => {
    argumentAudioRef.current = audioEl
    audioEl.addEventListener("ended", () => setAudioStatus("done"))
    setAudioStatus("playing-argument")
    audioEl.play().catch(() => setAudioStatus("done"))
  }, [])

  const startListening = useCallback(async () => {
    if (!exercise) return
    const id = exerciseIdParam || exercise.id
    setAudioStatus("loading")
    setAudioError("")
    try {
      if (exercise.has_narration_audio) {
        const narrationEl = await fetchAudioBlob(`/api/exercises/${id}/narration-audio`)
        narrationAudioRef.current = narrationEl
        if (exercise.has_argument_audio) {
          const argumentEl = await fetchAudioBlob(`/api/exercises/${id}/argument-audio`)
          narrationEl.addEventListener("ended", () => playArgumentAudio(argumentEl))
        } else {
          narrationEl.addEventListener("ended", () => setAudioStatus("done"))
        }
        setAudioStatus("playing-narration")
        narrationEl.play().catch(() => setAudioStatus("done"))
      } else if (exercise.has_argument_audio) {
        const argumentEl = await fetchAudioBlob(`/api/exercises/${id}/argument-audio`)
        playArgumentAudio(argumentEl)
      } else {
        setAudioStatus("done")
      }
    } catch {
      setAudioError("Could not load audio. Please read the argument text below.")
      setAudioStatus("done")
    }
  }, [exercise, exerciseIdParam, fetchAudioBlob, playArgumentAudio])

  useEffect(() => {
    if (stage === "listen" && audioStatus === "idle") startListening()
  }, [stage])

  // Countdown timer — prepare
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

  // Countdown timer — record
  useEffect(() => {
    if (stage !== "record") return
    if (recorder.state !== "recording") return
    if (recCountdown <= 0) { recorder.stopRecording(); return }
    const timer = setTimeout(() => setRecCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [stage, recorder.state, recCountdown])

  useEffect(() => {
    if (recorder.state === "stopped" && recorder.audioBlob && stage === "record") {
      submitResponse(recorder.audioBlob, recorder.transcript)
    }
  }, [recorder.state])

  const submitResponse = async (blob: Blob, transcript?: string) => {
    setStage("analyzing")
    setError("")
    const formData = new FormData()
    formData.append("audio", blob, "mock_test.webm")
    formData.append("exercise_id", String(exerciseIdParam || exercise!.id))
    if (transcript) formData.append("transcript", transcript)

    try {
      const data = await api.upload<CRAAResult>("/practice/craa-analyze", formData)
      setResult(data)
      setStage("result")
      if (data.session_id) {
        const token = localStorage.getItem("token")
        fetch(`/api/practice/session/${data.session_id}/audio`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => { if (!r.ok) throw new Error(); return r.blob() })
          .then(blob => {
            const url = URL.createObjectURL(blob)
            setPlaybackUrl(url)
            const audio = new Audio(url)
            audio.addEventListener("ended", () => setIsPlayingResult(false))
            playbackAudioRef.current = audio
          })
          .catch(() => {})
      }
    } catch (err: any) {
      setError(err.message || "Analysis failed")
      setStage("record")
    }
  }

  useEffect(() => {
    return () => { if (playbackUrl) URL.revokeObjectURL(playbackUrl) }
  }, [playbackUrl])

  const getScoreColor = (s: number) =>
    s >= 70 ? "text-green-600" : s >= 55 ? "text-amber-600" : "text-red-600"

  /* ============== RENDER ============== */

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/practice")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <h1 className="text-2xl font-bold">Mock Test</h1>
            <Badge variant="destructive">EXAM</Badge>
          </div>
        </div>

        {/* SELECT exercise */}
        {stage === "select" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-2">Select a Test Topic</h2>
                <p className="text-sm text-muted-foreground">
                  Choose a CRAA topic for your mock test. The test simulates real exam conditions.
                </p>
              </CardContent>
            </Card>

            {exercises.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-3">
                {exercises.map(ex => (
                  <Card
                    key={ex.id}
                    className="cursor-pointer hover:border-primary/60 hover:shadow-lg transition-all"
                    onClick={() => selectExercise(ex)}
                  >
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                        <Brain className="h-6 w-6 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{ex.title}</h3>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{ex.difficulty}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{ex.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RULES */}
        {stage === "rules" && exercise && (
          <div className="space-y-5">
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  <h2 className="text-xl font-bold">Mock Test Rules</h2>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <h3 className="font-semibold text-sm mb-2">{exercise.title}</h3>
                    <p className="text-sm text-muted-foreground">{exercise.description}</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Exam Conditions:</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <Headphones className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <span><strong>Listening (2 min):</strong> Audio is played <strong>once only</strong> — no replay allowed. Take notes while listening.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <span><strong>Preparation ({Math.round((exercise.preparation_time ?? 120) / 60)} min):</strong> Organise your summary and plan your counterargument. Timer auto-advances.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Mic className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span><strong>Response ({Math.round((exercise.response_time ?? 120) / 60)} min):</strong> Present your summary (~1 min) and counterargument (~1 min). <strong>No reference materials</strong> visible during recording.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Important:</strong> State your Name, Student ID, and Section before you start your response.
                    </p>
                  </div>

                  {/* Scoring info */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold text-primary">40%</p>
                      <p className="text-xs text-muted-foreground">Summary Accuracy</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold text-primary">30%</p>
                      <p className="text-xs text-muted-foreground">Counterargument</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold text-primary">30%</p>
                      <p className="text-xs text-muted-foreground">Verbal Delivery</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full bg-red-600 hover:bg-red-700" onClick={() => setStage("listen")}>
              <Shield className="h-4 w-4 mr-2" /> Start Mock Test
            </Button>
          </div>
        )}

        {/* LISTEN — No replay, notes only */}
        {stage === "listen" && exercise && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="text-center">
                <Badge variant="destructive" className="mb-3">MOCK TEST</Badge>
                <h2 className="text-xl font-bold mb-1">Listening Stage</h2>
                <p className="text-sm text-muted-foreground">The audio is played <strong>once only</strong>. Take notes carefully.</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-4">
                {audioStatus === "loading" && (
                  <div className="flex items-center justify-center gap-3 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm font-medium">Loading audio...</span>
                  </div>
                )}

                {(audioStatus === "playing-narration" || audioStatus === "playing-argument" || audioStatus === "done") && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        audioStatus === "playing-narration" ? "bg-primary text-primary-foreground" : "bg-green-500/15 text-green-600"
                      }`}>
                        {audioStatus === "playing-narration"
                          ? <Volume2 className="h-4 w-4 animate-pulse" />
                          : <CheckCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${audioStatus === "playing-narration" ? "text-foreground" : "text-muted-foreground"}`}>
                          Part 1: Background Information
                        </p>
                        {audioStatus === "playing-narration" && (
                          <p className="text-xs text-primary font-medium mt-0.5">Now playing...</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        audioStatus === "playing-argument" ? "bg-primary text-primary-foreground"
                        : audioStatus === "done" ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"
                      }`}>
                        {audioStatus === "playing-argument"
                          ? <Volume2 className="h-4 w-4 animate-pulse" />
                          : audioStatus === "done" ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs font-bold">2</span>}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${audioStatus === "playing-argument" ? "text-foreground" : audioStatus === "done" ? "text-muted-foreground" : "text-muted-foreground opacity-50"}`}>
                          Part 2: The Argument
                        </p>
                        {audioStatus === "playing-argument" && (
                          <p className="text-xs text-primary font-medium mt-0.5">Now playing...</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {audioError && <p className="text-xs text-destructive text-center">{audioError}</p>}

                {/* NO replay button in mock test — this is the key difference */}
                {audioStatus === "done" && (
                  <div className="text-center pt-1 text-xs text-muted-foreground">
                    Audio playback complete — no replay in test mode
                  </div>
                )}
              </div>

              {/* Show argument text only after audio finishes (as in the practice mode) */}
              {exercise.argument_text && audioStatus === "done" && (
                <div className="text-left p-4 rounded-lg bg-muted/50 max-h-56 overflow-y-auto">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Argument (for reference)</p>
                  <p className="text-sm leading-relaxed">{exercise.argument_text}</p>
                </div>
              )}

              {/* Notes */}
              <div className="text-left">
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">📝 Your Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={"Take notes here while listening...\n\n• Context: ...\n• Main Claim: ...\n• Evidence: ...\n• Explanation: ..."}
                  className="w-full h-40 p-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <Button
                size="lg" className="w-full"
                disabled={audioStatus !== "done"}
                onClick={() => {
                  narrationAudioRef.current?.pause()
                  argumentAudioRef.current?.pause()
                  setPrepCountdown(exercise.preparation_time ?? 120)
                  setStage("prepare")
                }}
              >
                <Clock className="h-4 w-4 mr-2" />
                {audioStatus === "done" ? "Start Preparation Time" : "Waiting for audio to finish..."}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PREPARE — Notes and key claim only, no argument text */}
        {stage === "prepare" && exercise && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <Badge variant="destructive" className="mx-auto">MOCK TEST</Badge>
              <h2 className="text-xl font-bold">Preparation Time</h2>
              <p className="text-muted-foreground text-sm">Organise your summary and plan your counterargument. Recording starts automatically.</p>
              <CountdownRing seconds={prepCountdown} total={exercise.preparation_time ?? 120} warn />

              <div className="text-left p-4 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Key Claim to Respond To</p>
                <p className="text-sm font-medium">"{exercise.key_claim}"</p>
              </div>

              {/* Notes */}
              <div className="text-left">
                <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">Your Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Review and refine your notes..."
                  className="w-full h-32 p-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Remember: State your <strong>Name</strong>, <strong>Student ID</strong>, and <strong>Section</strong> before your response.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* RECORD — No reference materials visible (exam conditions) */}
        {stage === "record" && exercise && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <Badge variant="destructive" className="mx-auto">RECORDING</Badge>
              <h2 className="text-xl font-bold">Your Response</h2>
              <CountdownRing seconds={recCountdown} total={exercise.response_time ?? 120} warn />

              {!recorder.isSpeechRecognitionSupported && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm">
                  <span>Live transcription is not available in this browser.</span>
                </div>
              )}

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
                  {recorder.interimTranscript && (
                    <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground italic truncate">{recorder.interimTranscript}</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Speak clearly. No reference materials in test mode.</p>
                  <Button variant="destructive" onClick={() => recorder.stopRecording()}>
                    Finish Response
                  </Button>
                </div>
              ) : null}

              {/* Only show notes — no materials */}
              {notes && (
                <div className="p-3 rounded-lg bg-muted/50 border max-h-24 overflow-y-auto text-left">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Your Notes</p>
                  <p className="text-xs whitespace-pre-line">{notes}</p>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {/* ANALYZING */}
        {stage === "analyzing" && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <Brain className="h-12 w-12 mx-auto text-primary animate-pulse" />
              <h2 className="text-xl font-bold">Grading Your Response</h2>
              <div className="space-y-3 max-w-xs mx-auto text-left">
                {[
                  "Transcribing speech...",
                  "Evaluating summary accuracy...",
                  "Assessing counterargument quality...",
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
        {stage === "result" && result && exercise && (
          <div className="space-y-6">
            {/* Score card */}
            <Card className="border-primary/20">
              <CardContent className="p-6 text-center">
                <Badge variant="destructive" className="mb-3">MOCK TEST RESULT</Badge>
                <h2 className="text-xl font-bold mb-1">{exercise.title}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {user?.role === "student" && user?.student_code ? user.student_code : user?.name}
                </p>
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

            <ScoreDimension label="Summary Accuracy" score={result.summary_score} weight="40%" feedback={result.summary_feedback} color={getScoreColor(result.summary_score)} />
            <ScoreDimension label="Counterargument Quality" score={result.counterargument_score} weight="30%" feedback={result.counterargument_feedback} color={getScoreColor(result.counterargument_score)} />
            <ScoreDimension label="Verbal Delivery" score={result.delivery_score} weight="30%" feedback={result.delivery_feedback} color={getScoreColor(result.delivery_score)} />

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

            {/* Play recording */}
            {playbackAudioRef.current && (
              <Card>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Volume2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Your Recording</p>
                        <p className="text-xs text-muted-foreground">Listen to your response</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      if (!playbackAudioRef.current) return
                      if (isPlayingResult) { playbackAudioRef.current.pause() } else { playbackAudioRef.current.play() }
                      setIsPlayingResult(!isPlayingResult)
                    }} className="gap-2">
                      {isPlayingResult ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPlayingResult ? "Pause" : "Play"}
                    </Button>
                  </div>
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
              <Button variant="outline" onClick={() => navigate("/practice")}>Back to Practice</Button>
              <Button variant="outline" onClick={() => navigate("/history")}>View History</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
