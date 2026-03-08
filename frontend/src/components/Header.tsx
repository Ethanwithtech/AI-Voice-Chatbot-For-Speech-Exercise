import { useNavigate } from "react-router-dom"
import { Mic, LogOut, User } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "./ThemeToggle"

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const roleColor = {
    admin: "destructive" as const,
    teacher: "default" as const,
    student: "secondary" as const,
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 glass border-b">
      <div className="flex items-center justify-between h-full px-6 max-w-7xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-md">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
            AI Speech Coach
          </span>
        </button>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{user.name}</span>
                <Badge variant={roleColor[user.role]}>{user.role}</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
