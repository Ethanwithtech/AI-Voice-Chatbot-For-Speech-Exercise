import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { api } from "./api"

export interface User {
  id: number
  name: string
  email?: string | null
  role: "student" | "teacher" | "admin"
  student_code?: string | null
  created_at?: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  loginStudent: (studentCode: string) => Promise<void>
  loginTeacher: (email: string, password: string) => Promise<void>
  logout: () => void
  isTeacher: boolean
  isAdmin: boolean
  isStudent: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"))
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
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
  }

  const loginTeacher = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/teacher-login", {
      email,
      password,
    })
    localStorage.setItem("token", res.token)
    setToken(res.token)
    setUser(res.user)
  }

  const isTeacher = user?.role === "teacher" || user?.role === "admin"
  const isAdmin = user?.role === "admin"
  const isStudent = user?.role === "student"

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      loginStudent, loginTeacher, logout,
      isTeacher, isAdmin, isStudent,
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
