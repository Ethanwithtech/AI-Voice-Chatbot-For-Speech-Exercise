import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-primary/30 mb-4">404</h1>
        <p className="text-xl font-semibold mb-2">Page Not Found</p>
        <p className="text-muted-foreground mb-6">The page you are looking for does not exist.</p>
        <Button onClick={() => navigate("/")}>Back to Home</Button>
      </div>
    </div>
  )
}
