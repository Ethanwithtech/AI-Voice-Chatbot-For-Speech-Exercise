export type DifficultyLevel = "easy" | "medium" | "hard"
export type ExerciseType = "read_aloud" | "free_speech" | "qa"

export interface Exercise {
  id: number
  teacher_id: number
  title: string
  description: string
  reference_text?: string | null
  difficulty: DifficultyLevel
  exercise_type: ExerciseType
  created_at?: string | null
  teacher_name?: string | null
}

export interface CreateExerciseInput {
  title: string
  description: string
  reference_text?: string
  difficulty: DifficultyLevel
  exercise_type: ExerciseType
}
