import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react"
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
    }

    if (editingId) {
      api.put(`/exercises/${editingId}`, data)
        .then(() => { setDialogOpen(false); loadExercises(); resetForm() })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      api.post("/exercises/", data)
        .then(() => { setDialogOpen(false); loadExercises(); resetForm() })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this exercise?")) return
    api.delete(`/exercises/${id}`)
      .then(loadExercises)
      .catch(console.error)
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
                      <Badge variant="outline">{ex.exercise_type.replace("_", " ")}</Badge>
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Exercise title" required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Instructions for students" required />
            </div>
            <div className="space-y-2">
              <Label>Reference Text (optional)</Label>
              <Textarea value={referenceText} onChange={e => setReferenceText(e.target.value)} placeholder="Text for read-aloud exercises" />
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
