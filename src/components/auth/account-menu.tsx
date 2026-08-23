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
import { KeyRound, LogOut, UserRound } from "lucide-react"
import * as React from "react"

export function AccountMenu() {
  const { data: me } = useQuery(meQueryOptions())
  const [changingPassword, setChangingPassword] = React.useState(false)
  const logout = useLogoutMutation()

  const handleLogout = () => {
    // The authenticated layout owns navigation so it can preserve this page.
    logout.mutate()
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
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate font-medium">
                {me?.username ?? "Signed in"}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                Roles:{" "}
                <span>
                  {me?.roles.length ? me.roles.join(", ") : "no roles"}
                </span>
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
