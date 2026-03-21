import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Pencil, Trash2, Upload, Loader2, Volume2, Brain, Eye, Shield } from "lucide-react"
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

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [referenceText, setReferenceText] = useState("")
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium")
  const [exerciseType, setExerciseType] = useState<ExerciseType>("free_speech")

  // CRAA-specific fields
  const [argumentText, setArgumentText] = useState("")
  const [topicContext, setTopicContext] = useState("")
  const [keyClaim, setKeyClaim] = useState("")
  const [preparationTime, setPreparationTime] = useState(120)
  const [responseTime, setResponseTime] = useState(120)

  // Audio upload state
  const [videoUrl, setVideoUrl] = useState("")
  const [argumentAudioFile, setArgumentAudioFile] = useState<File | null>(null)
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioUploadedForId, setAudioUploadedForId] = useState<number | null>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadExercises()
  }, [])

  const loadExercises = () => {
    api.get<Exercise[]>("/exercises/").then(setExercises).catch(console.error)
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setReferenceText("")
    setDifficulty("medium")
    setExerciseType("free_speech")
    setArgumentText("")
    setTopicContext("")
    setKeyClaim("")
    setPreparationTime(120)
    setResponseTime(120)
    setVideoUrl("")
    setArgumentAudioFile(null)
    setAudioUploadedForId(null)
    setEditingId(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (ex: Exercise) => {
    setTitle(ex.title)
    setDescription(ex.description)
    setReferenceText(ex.reference_text || "")
    setDifficulty(ex.difficulty)
    setExerciseType(ex.exercise_type)
    setArgumentText(ex.argument_text || "")
    setTopicContext(ex.topic_context || "")
    setKeyClaim(ex.key_claim || "")
    setPreparationTime(ex.preparation_time ?? 120)
    setResponseTime(ex.response_time ?? 120)
    setVideoUrl(ex.video_url || "")
    setArgumentAudioFile(null)
    setAudioUploadedForId(null)
    setEditingId(ex.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const data: CreateExerciseInput = {
      title,
      description,
      reference_text: referenceText || undefined,
      difficulty,
      exercise_type: exerciseType,
      ...(exerciseType === "craa" ? {
        argument_text: argumentText || undefined,
        topic_context: topicContext || undefined,
        key_claim: keyClaim || undefined,
        preparation_time: preparationTime,
        response_time: responseTime,
        video_url: videoUrl || undefined,
      } : {}),
    }

    try {
      if (editingId) {
        await api.put(`/exercises/${editingId}`, data)
        if (argumentAudioFile) {
          await uploadArgumentAudio(editingId, argumentAudioFile)
        }
        setDialogOpen(false)
        loadExercises()
        resetForm()
      } else {
        const created = await api.post<Exercise>("/exercises/", data)
        if (argumentAudioFile && created.id) {
          await uploadArgumentAudio(created.id, argumentAudioFile)
        }
        setDialogOpen(false)
        loadExercises()
        resetForm()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const uploadArgumentAudio = async (exerciseId: number, file: File) => {
    setAudioUploading(true)
    const formData = new FormData()
    formData.append("audio", file, file.name)
    const token = localStorage.getItem("token")
    await fetch(`/api/exercises/${exerciseId}/argument-audio`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    setAudioUploading(false)
    setAudioUploadedForId(exerciseId)
  }

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this exercise?")) return
    api.delete(`/exercises/${id}`)
      .then(loadExercises)
      .catch(console.error)
  }

  const getTypeLabel = (type: string) => {
    const found = typeOptions.find(o => o.value === type)
    return found?.label ?? type.replace("_", " ")
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
                      {ex.exercise_type === "craa" && <Brain className="h-4 w-4 text-primary" />}
                      <h3 className="font-semibold">{ex.title}</h3>
                      <Badge variant={ex.difficulty === "easy" ? "success" : ex.difficulty === "hard" ? "destructive" : "warning"}>
                        {ex.difficulty}
                      </Badge>
                      <Badge variant={ex.exercise_type === "craa" ? "default" : "outline"}>
                        {getTypeLabel(ex.exercise_type)}
                      </Badge>
                      {ex.has_argument_audio && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">
                          <Volume2 className="h-3 w-3 mr-1" /> Audio
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{ex.description}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    {ex.exercise_type === "craa" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Preview as Practice"
                          onClick={() => navigate(`/craa-practice?exerciseId=${ex.id}`)}
                        >
                          <Eye className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Preview as Mock Test"
                          onClick={() => navigate(`/mock-test?exerciseId=${ex.id}`)}
                        >
                          <Shield className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                    {ex.exercise_type !== "craa" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Preview Exercise"
                        onClick={() => navigate(`/practice?exerciseId=${ex.id}`)}
                      >
                        <Eye className="h-4 w-4 text-blue-500" />
                      </Button>
                    )}
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

            {exerciseType !== "craa" && (
              <div className="space-y-2">
                <Label>Reference Text (optional)</Label>
                <Textarea value={referenceText} onChange={e => setReferenceText(e.target.value)} placeholder="Text for read-aloud exercises" />
              </div>
            )}

            {exerciseType === "craa" && (
              <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">CRAA Configuration</h3>
                </div>

                <div className="space-y-2">
                  <Label>Topic Context</Label>
                  <Textarea
                    value={topicContext}
                    onChange={e => setTopicContext(e.target.value)}
                    placeholder="Background context for the topic (e.g. 'In recent years, AI has transformed education...')"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Key Claim</Label>
                  <Input
                    value={keyClaim}
                    onChange={e => setKeyClaim(e.target.value)}
                    placeholder="The main argument claim (e.g. 'AI will replace teachers within 10 years')"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Argument Text <span className="text-muted-foreground text-xs">(what students read/hear)</span></Label>
                  <Textarea
                    value={argumentText}
                    onChange={e => setArgumentText(e.target.value)}
                    placeholder="The full academic argument text that students must listen to and critically respond to..."
                    rows={5}
                    required={exerciseType === "craa"}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Argument Audio <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => audioInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {argumentAudioFile ? argumentAudioFile.name : "Upload Audio File"}
                    </Button>
                    {audioUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {audioUploadedForId && !audioUploading && (
                      <span className="text-xs text-green-600">Audio uploaded</span>
                    )}
                  </div>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) setArgumentAudioFile(file)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Supported: MP3, WAV, WebM, OGG (max 50MB)</p>
                </div>

                <div className="space-y-2">
                  <Label>Background Video URL <span className="text-muted-foreground text-xs">(optional YouTube link)</span></Label>
                  <Input
                    type="url"
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="text-xs text-muted-foreground">Students will see this video on the intro screen to learn about the topic before starting.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preparation Time (seconds)</Label>
                    <Input
                      type="number"
                      min={30}
                      max={600}
                      value={preparationTime}
                      onChange={e => setPreparationTime(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Response Time (seconds)</Label>
                    <Input
                      type="number"
                      min={30}
                      max={600}
                      value={responseTime}
                      onChange={e => setResponseTime(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || audioUploading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </div>
  )
}
