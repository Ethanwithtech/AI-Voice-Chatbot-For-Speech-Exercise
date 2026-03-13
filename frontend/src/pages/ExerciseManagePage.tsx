import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Pencil, Trash2, Upload, X } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Exercise, CreateExerciseInput, DifficultyLevel, ExerciseType } from "@/types/exercise"

const difficultyOptions = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
]

const typeOptions = [
  { value: "read_aloud", label: "Read Aloud" },
  { value: "free_speech", label: "Free Speech" },
  { value: "qa", label: "Q&A" },
  { value: "craa", label: "CRAA (Critical Response)" },
]

export default function ExerciseManagePage() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Common fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [referenceText, setReferenceText] = useState("")
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium")
  const [exerciseType, setExerciseType] = useState<ExerciseType>("free_speech")

  // CRAA fields
  const [argumentText, setArgumentText] = useState("")
  const [topicContext, setTopicContext] = useState("")
  const [keyClaim, setKeyClaim] = useState("")
  const [preparationTime, setPreparationTime] = useState(120)
  const [responseTime, setResponseTime] = useState(120)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState("")
  const audioInputRef = useRef<HTMLInputElement>(null)

  const isCRAA = exerciseType === "craa"

  useEffect(() => { loadExercises() }, [])

  const loadExercises = () => {
    api.get<Exercise[]>("/exercises/").then(setExercises).catch(console.error)
  }

  const resetForm = () => {
    setTitle(""); setDescription(""); setReferenceText("")
    setDifficulty("medium"); setExerciseType("free_speech")
    setArgumentText(""); setTopicContext(""); setKeyClaim("")
    setPreparationTime(120); setResponseTime(120)
    setAudioFile(null); setVideoUrl(""); setEditingId(null)
  }

  const openCreateDialog = () => { resetForm(); setDialogOpen(true) }

  const openEditDialog = (ex: Exercise) => {
    setTitle(ex.title)
    setDescription(ex.description)
    setReferenceText(ex.reference_text || "")
    setDifficulty(ex.difficulty)
    setExerciseType(ex.exercise_type)
    setArgumentText(ex.argument_text || "")
    setTopicContext(ex.topic_context || "")
    setKeyClaim(ex.key_claim || "")
    setPreparationTime(ex.preparation_time || 120)
    setResponseTime(ex.response_time || 120)
    setVideoUrl(ex.video_url || "")
    setAudioFile(null)
    setEditingId(ex.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const data: CreateExerciseInput = {
      title, description,
      reference_text: referenceText || undefined,
      difficulty, exercise_type: exerciseType,
      ...(isCRAA ? {
        argument_text: argumentText || undefined,
        topic_context: topicContext || undefined,
        key_claim: keyClaim || undefined,
        preparation_time: preparationTime,
        response_time: responseTime,
        video_url: videoUrl || undefined,
      } : {}),
    }

    try {
      let savedEx: Exercise
      if (editingId) {
        savedEx = await api.put<Exercise>(`/exercises/${editingId}`, data)
      } else {
        savedEx = await api.post<Exercise>("/exercises/", data)
      }

      // Upload argument audio if provided
      if (audioFile && savedEx.id) {
        const formData = new FormData()
        formData.append("audio", audioFile)
        await api.upload(`/exercises/${savedEx.id}/argument-audio`, formData)
      }

      setDialogOpen(false)
      loadExercises()
      resetForm()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this exercise?")) return
    api.delete(`/exercises/${id}`).then(loadExercises).catch(console.error)
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
            </Button>
            <h1 className="text-2xl font-bold">Exercise Management</h1>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" /> New Exercise
          </Button>
        </div>

        {exercises.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No exercises created yet</p>
              <Button onClick={openCreateDialog}>Create Your First Exercise</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {exercises.map(ex => (
              <Card key={ex.id} className="hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{ex.title}</h3>
                      <Badge variant={ex.difficulty === "easy" ? "success" : ex.difficulty === "hard" ? "destructive" : "warning"}>
                        {ex.difficulty}
                      </Badge>
                      <Badge variant={ex.exercise_type === "craa" ? "default" : "outline"}>
                        {ex.exercise_type === "craa" ? "CRAA" : ex.exercise_type.replace("_", " ")}
                      </Badge>
                      {ex.has_argument_audio && <Badge variant="outline" className="text-xs">🔊 Audio</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{ex.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(ex)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(ex.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Exercise" : "Create Exercise"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Exercise title" required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Instructions for students" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select options={difficultyOptions} value={difficulty} onChange={e => setDifficulty(e.target.value as DifficultyLevel)} />
              </div>
              <div className="space-y-2">
                <Label>Exercise Type</Label>
                <Select options={typeOptions} value={exerciseType} onChange={e => setExerciseType(e.target.value as ExerciseType)} />
              </div>
            </div>

            {!isCRAA && (
              <div className="space-y-2">
                <Label>Reference Text (optional)</Label>
                <Textarea value={referenceText} onChange={e => setReferenceText(e.target.value)} placeholder="Text for read-aloud exercises" />
              </div>
            )}

            {/* CRAA-specific fields */}
            {isCRAA && (
              <div className="space-y-4 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  CRAA Configuration
                </h3>

                <div className="space-y-2">
                  <Label>Topic Context / Background</Label>
                  <Textarea
                    value={topicContext}
                    onChange={e => setTopicContext(e.target.value)}
                    placeholder="Background information about the topic (e.g., Mindfulness is the practice of paying attention to your current body condition and feelings...)"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Key Claim *</Label>
                  <Textarea
                    value={keyClaim}
                    onChange={e => setKeyClaim(e.target.value)}
                    placeholder="The core claim students need to summarise and counter (e.g., Mindfulness programmes should be implemented in workplaces because they reduce employee stress...)"
                    rows={3}
                    required={isCRAA}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Argument Text / Transcript *</Label>
                  <Textarea
                    value={argumentText}
                    onChange={e => setArgumentText(e.target.value)}
                    placeholder="Full text of the argument recording that students will listen to. Include context, claim, evidence, and explanation."
                    rows={6}
                    required={isCRAA}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Argument Audio (optional)</Label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={e => setAudioFile(e.target.files?.[0] || null)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => audioInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {audioFile ? "Change File" : "Upload Audio"}
                    </Button>
                    {audioFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="truncate max-w-[200px]">{audioFile.name}</span>
                        <button type="button" onClick={() => setAudioFile(null)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {editingId && !audioFile && exercises.find(e => e.id === editingId)?.has_argument_audio && (
                      <span className="text-xs text-green-600">✓ Audio already uploaded</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Upload the argument recording (MP3/WAV/WebM). If not provided, students will read the argument text.</p>
                </div>

                <div className="space-y-2">
                  <Label>Background Video URL (optional)</Label>
                  <Input
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... (warm-up video for students to watch before practice)"
                  />
                  <p className="text-xs text-muted-foreground">Optional YouTube video for students to learn about the topic before the CRAA exercise.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preparation Time (seconds)</Label>
                    <Input type="number" value={preparationTime} onChange={e => setPreparationTime(Number(e.target.value))} min={30} max={600} />
                  </div>
                  <div className="space-y-2">
                    <Label>Response Time (seconds)</Label>
                    <Input type="number" value={responseTime} onChange={e => setResponseTime(Number(e.target.value))} min={30} max={600} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </div>
  )
}
