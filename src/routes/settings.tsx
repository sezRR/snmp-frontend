import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { API_BASE_URL } from "@/lib/api/client"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Connection and appearance settings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">API base URL</span>
            <code className="rounded bg-muted px-2 py-0.5">
              {API_BASE_URL || "same origin (dev mock)"}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Theme</span>
            <span>
              Use the toggle in the header, or press{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">
                d
              </kbd>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
