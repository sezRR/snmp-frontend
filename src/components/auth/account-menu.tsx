import { ChangePasswordDialog } from "@/components/auth/change-password-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { meQueryOptions, useLogoutMutation } from "@/lib/queries/auth"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { KeyRound, LogOut, UserRound } from "lucide-react"
import * as React from "react"

/** Who is signed in, and the two things they can do about it. */
export function AccountMenu() {
  const { data: me } = useQuery(meQueryOptions())
  const [changingPassword, setChangingPassword] = React.useState(false)
  const navigate = useNavigate()
  const logout = useLogoutMutation()

  const handleLogout = () => {
    // The mutation clears the session either way, so the redirect does not
    // wait on a backend that may be the reason the user is leaving.
    logout.mutate(undefined, {
      onSettled: () => void navigate({ to: "/login" }),
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Account">
              <UserRound />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-52">
          {/* Base UI's GroupLabel is only valid inside a Group. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate font-medium">
                {me?.username ?? "Signed in"}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {me?.roles.length ? me.roles.join(", ") : "no roles"}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setChangingPassword(true)}>
            <KeyRound />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={logout.isPending}
            onClick={handleLogout}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog
        open={changingPassword}
        onOpenChange={setChangingPassword}
      />
    </>
  )
}
