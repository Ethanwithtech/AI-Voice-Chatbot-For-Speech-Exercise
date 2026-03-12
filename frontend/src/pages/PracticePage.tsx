import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, Upload, CheckCircle, ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { AudioRecorder } from "@/components/AudioRecorder"
import { TranscriptDisplay } from "@/components/TranscriptDisplay"
import { FeedbackPanel } from "@/components/FeedbackPanel"
import { ProsodyChart } from "@/components/ProsodyChart"
import { ExerciseCard } from "@/components/ExerciseCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Exercise } from "@/types/exercise"
import type { AnalysisResult } from "@/types/practice"

type Stage = "select" | "record" | "analyzing" | "result"

const analyzeSteps = [
  { label: "Uploading audio...", icon: Upload },
  { label: "Transcribing speech...", icon: Loader2 },
  { label: "Analyzing voice features...", icon: Loader2 },
  { label: "Generating feedback...", icon: Loader2 },
]

export default function PracticePage() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [stage, setStage] = useState<Stage>("select")
  const [analyzeStep, setAnalyzeStep] = useState(0)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState("")

  const recorder = useAudioRecorder()

  useEffect(() => {
    api.get<Exercise[]>("/exercises/").then(setExercises).catch(console.error)
  }, [])

  const handleStartPractice = () => {
    if (selectedExercise?.exercise_type === "craa") {
      navigate(`/craa-practice?exerciseId=${selectedExercise.id}`)
      return
    }
    setStage("record")
    setResult(null)
    setError("")
    recorder.reset()
  }

  const handleStopAndAnalyze = async () => {
    recorder.stopRecording()
  }

  useEffect(() => {
    if (recorder.state === "stopped" && recorder.audioBlob) {
      submitAudio(recorder.audioBlob)
    }
  }, [recorder.state])

  const submitAudio = async (blob: Blob) => {
    setStage("analyzing")
    setAnalyzeStep(0)

    const formData = new FormData()
    formData.append("audio", blob, "recording.webm")
    if (selectedExercise) {
      formData.append("exercise_id", String(selectedExercise.id))
    }

    const stepInterval = setInterval(() => {
      setAnalyzeStep(prev => Math.min(prev + 1, analyzeSteps.length - 1))
    }, 2000)

    api.upload<AnalysisResult>("/practice/analyze", formData)
      .then(data => {
        clearInterval(stepInterval)
        setResult(data)
        setStage("result")
      })
      .catch(err => {
        clearInterval(stepInterval)
        setError(err.message)
        setStage("record")
      })
  }

  if (stage === "result" && result) {
    return (
      <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => { setStage("select"); recorder.reset() }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <h1 className="text-2xl font-bold">Practice Results</h1>
          </div>

          <div className="space-y-6">
            <TranscriptDisplay
              transcript={result.transcript}
              errors={result.errors}
              pronunciationIssues={result.pronunciation_issues}
            />
            <ProsodyChart metrics={result.prosody} />
            <FeedbackPanel
              scores={result.scores}
              llmFeedback={result.llm_feedback}
              prosodyFeedback={result.prosody_feedback}
              pronunciationFeedback={result.pronunciation_feedback}
              strengths={result.strengths}
              areasToImprove={result.areas_to_improve}
              suggestions={result.suggestions}
            />

            <div className="flex gap-3 justify-center">
              <Button onClick={handleStartPractice}>Practice Again</Button>
              <Button variant="outline" onClick={() => navigate("/")}>Back to Dashboard</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Speech Practice</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Select Exercise
            </h2>
            {exercises.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exercises available yet.</p>
            ) : (
              exercises.map(ex => (
                <ExerciseCard
                  key={ex.id} exercise={ex}
                  selected={selectedExercise?.id === ex.id}
                  onClick={() => setSelectedExercise(ex)}
                />
              ))
            )}
          </div>

          <div className="lg:col-span-2">
            <Card className="min-h-[400px]">
              <CardContent className="p-6">
                {stage === "select" && (
                  <div className="text-center py-12">
                    {selectedExercise ? (
                      <div className="space-y-4">
                        <h2 className="text-xl font-bold">{selectedExercise.title}</h2>
                        <p className="text-muted-foreground max-w-md mx-auto">{selectedExercise.description}</p>
                        {selectedExercise.reference_text && (
                          <div className="mt-4 p-4 rounded-lg bg-muted/50 text-left max-w-lg mx-auto">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Reference Text</p>
                            <p className="text-sm leading-relaxed">{selectedExercise.reference_text}</p>
                          </div>
                        )}
                        {selectedExercise.exercise_type === "craa" && (
                          <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20 max-w-lg mx-auto text-left">
                            <p className="text-xs font-semibold text-primary uppercase mb-1">CRAA Exercise</p>
                            <p className="text-sm text-muted-foreground">This exercise uses the Critical Response and Argument Analysis guided practice mode.</p>
                          </div>
                        )}
                        <Button size="lg" onClick={handleStartPractice} className="mt-4">
                          {selectedExercise.exercise_type === "craa" ? "Start CRAA Practice" : "Start Recording"}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <p className="text-lg font-medium mb-2">Select an exercise to begin</p>
                        <p className="text-sm">Choose from the list on the left, or start free practice</p>
                        <Button variant="outline" className="mt-4" onClick={handleStartPractice}>
                          Free Practice (No Exercise)
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {stage === "record" && (
                  <AudioRecorder
                    state={recorder.state}
                    countdown={recorder.countdown}
                    duration={recorder.duration}
                    analyserNode={recorder.analyserNode}
                    onStart={recorder.startCountdown}
                    onStop={handleStopAndAnalyze}
                  />
                )}

                {stage === "analyzing" && (
                  <div className="py-12 space-y-6">
                    <div className="flex justify-center">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                    <div className="max-w-xs mx-auto space-y-3">
                      {analyzeSteps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          {idx < analyzeStep ? (
                            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                          ) : idx === analyzeStep ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
                          )}
                          <span className={`text-sm ${idx <= analyzeStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    {error && <p className="text-center text-sm text-destructive">{error}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
