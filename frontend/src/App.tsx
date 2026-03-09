import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider, useAuth } from "@/lib/auth"
import { ThemeProvider } from "@/lib/theme"
import { Header } from "@/components/Header"
import LoginPage from "@/pages/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import PracticePage from "@/pages/PracticePage"
import HistoryPage from "@/pages/HistoryPage"
import ResultPage from "@/pages/ResultPage"
import ExerciseManagePage from "@/pages/ExerciseManagePage"
import StudentManagePage from "@/pages/StudentManagePage"
import StudentSessionsPage from "@/pages/StudentSessionsPage"
import NotFoundPage from "@/pages/NotFoundPage"

const queryClient = new QueryClient()

function ProtectedRoute({ children, requireRole }: { children: React.ReactNode; requireRole?: string[] }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (requireRole && !requireRole.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Header />
          <DashboardPage />
        </ProtectedRoute>
      } />

      <Route path="/practice" element={
        <ProtectedRoute>
          <Header />
          <PracticePage />
        </ProtectedRoute>
      } />

      <Route path="/history" element={
        <ProtectedRoute>
          <Header />
          <HistoryPage />
        </ProtectedRoute>
      } />

      <Route path="/result/:sessionId" element={
        <ProtectedRoute>
          <Header />
          <ResultPage />
        </ProtectedRoute>
      } />

      <Route path="/exercises/manage" element={
        <ProtectedRoute requireRole={["teacher", "admin"]}>
          <Header />
          <ExerciseManagePage />
        </ProtectedRoute>
      } />

      <Route path="/students" element={
        <ProtectedRoute requireRole={["teacher", "admin"]}>
          <Header />
          <StudentManagePage />
        </ProtectedRoute>
      } />

      <Route path="/students/:userId" element={
        <ProtectedRoute requireRole={["teacher", "admin"]}>
          <Header />
          <StudentSessionsPage />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
