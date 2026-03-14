import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { api } from "./api"

export interface User {
  id: number
  name: string
  email?: string | null
  role: "student" | "teacher" | "admin"
  student_code?: string | null
  section?: string | null
  created_at?: string | null
}

type ViewMode = "default" | "student"

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  loginStudent: (studentCode: string) => Promise<void>
  registerStudent: (lastFourDigits: string, initials: string, section?: string) => Promise<{ code: string }>
  loginTeacher: (email: string, password: string) => Promise<void>
  requestTeacherAccess: (name: string, email: string, password: string, reason?: string) => Promise<void>
  logout: () => void
  isTeacher: boolean
  isAdmin: boolean
  isStudent: boolean
  // View mode switching
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  canSwitchView: boolean
  actualRole: string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"))
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("default")

  const logout = useCallback(() => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
    setViewMode("default")
  }, [])

  useEffect(() => {
    if (token) {
      api.get<User>("/auth/me")
        .then(setUser)
        .catch(() => logout())
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [token, logout])

  const loginStudent = async (studentCode: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/student-login", {
      student_code: studentCode,
    })
    localStorage.setItem("token", res.token)
    setToken(res.token)
    setUser(res.user)
    setViewMode("default")
  }

  const registerStudent = async (lastFourDigits: string, initials: string, section?: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/student-register", {
      last_four_digits: lastFourDigits,
      initials: initials,
      section: section || undefined,
    })
    localStorage.setItem("token", res.token)
    setToken(res.token)
    setUser(res.user)
    setViewMode("default")
    return { code: res.user.student_code || "" }
  }

  const loginTeacher = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/teacher-login", {
      email,
      password,
    })
    localStorage.setItem("token", res.token)
    setToken(res.token)
    setUser(res.user)
    setViewMode("default")
  }

  const requestTeacherAccess = async (name: string, email: string, password: string, reason?: string) => {
    await api.post("/auth/teacher-request-access", {
      name,
      email,
      password,
      reason: reason || undefined,
    })
    // Don't auto-login — account needs approval
  }

  const actualRole = user?.role ?? null
  const canSwitchView = actualRole === "teacher" || actualRole === "admin"

  // When viewMode is "student", pretend to be a student for UI purposes
  const isStudentView = viewMode === "student" && canSwitchView
  const isTeacher = !isStudentView && (user?.role === "teacher" || user?.role === "admin")
  const isAdmin = !isStudentView && user?.role === "admin"
  const isStudent = user?.role === "student" || isStudentView

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      loginStudent, registerStudent, loginTeacher, requestTeacherAccess, logout,
      isTeacher, isAdmin, isStudent,
      viewMode, setViewMode, canSwitchView, actualRole,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
