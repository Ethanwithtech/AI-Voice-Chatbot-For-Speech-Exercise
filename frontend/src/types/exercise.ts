export type DifficultyLevel = "easy" | "medium" | "hard"
export type ExerciseType = "read_aloud" | "free_speech" | "qa" | "craa"

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
  argument_text?: string | null
  topic_context?: string | null
  key_claim?: string | null
  preparation_time?: number | null
  response_time?: number | null
  has_argument_audio?: boolean
  video_url?: string | null
}

export interface CreateExerciseInput {
  title: string
  description: string
  reference_text?: string
  difficulty: DifficultyLevel
  exercise_type: ExerciseType
  argument_text?: string
  topic_context?: string
  key_claim?: string
  preparation_time?: number
  response_time?: number
  video_url?: string
}
