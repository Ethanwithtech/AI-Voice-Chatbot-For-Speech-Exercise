import { BookOpen, MessageSquare, HelpCircle, Brain } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Exercise } from "@/types/exercise"

const difficultyColors = {
  easy: "success",
  medium: "warning",
  hard: "destructive",
} as const

const typeIcons = {
  read_aloud: BookOpen,
  free_speech: MessageSquare,
  qa: HelpCircle,
  craa: Brain,
}

const typeLabels = {
  read_aloud: "Read Aloud",
  free_speech: "Free Speech",
  qa: "Q&A",
  craa: "CRAA",
}

interface ExerciseCardProps {
  exercise: Exercise
  onClick?: () => void
  selected?: boolean
}

export function ExerciseCard({ exercise, onClick, selected }: ExerciseCardProps) {
  const Icon = typeIcons[exercise.exercise_type] || MessageSquare

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 ${
        selected ? "ring-2 ring-primary border-primary" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{exercise.title}</CardTitle>
          </div>
          <div className="flex gap-1.5">
            <Badge variant={difficultyColors[exercise.difficulty]}>
              {exercise.difficulty}
            </Badge>
            <Badge variant={exercise.exercise_type === "craa" ? "default" : "outline"}>
              {typeLabels[exercise.exercise_type] || exercise.exercise_type}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2">{exercise.description}</CardDescription>
        {exercise.teacher_name && (
          <p className="text-xs text-muted-foreground mt-2">By {exercise.teacher_name}</p>
        )}
      </CardContent>
    </Card>
  )
}
