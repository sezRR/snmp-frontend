import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
import { machineName, machinesQueryOptions } from "@/lib/queries/machines"
import { useViews } from "@/lib/views"
import { useQuery } from "@tanstack/react-query"
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "@tanstack/react-router"
import { Check, ChevronsUpDown } from "lucide-react"

// The trail carries the work, so the header no longer repeats the app name:
// it says where you are, and the leaf doubles as a switcher between siblings
// so hopping to another machine or view does not mean going back to a list.

interface SwitcherOption {
  id: string
  label: string
  hint?: string
}

export function AppBreadcrumbs() {
  const { pathname } = useLocation()
  const { mac, viewId } = useParams({ strict: false })
  const navigate = useNavigate()
  const views = useViews()
  const { data: machines } = useQuery({
    ...machinesQueryOptions(),
    // Only the machine trail needs the list; elsewhere it stays out of the way.
    enabled: pathname.startsWith("/machines"),
  })

  if (pathname === "/") {
    return (
      <Trail>
        <BreadcrumbItem>
          <BreadcrumbPage>Dashboard</BreadcrumbPage>
        </BreadcrumbItem>
      </Trail>
    )
  }

  if (mac) {
    const current = machines?.find((machine) => machine.mac === mac)
    return (
      <Trail>
        <Crumb to="/">Dashboard</Crumb>
        <BreadcrumbSeparator className="hidden sm:block" />
        <Crumb to="/machines">Machines</Crumb>
        <BreadcrumbSeparator className="hidden sm:block" />
        <BreadcrumbItem>
          <Switcher
            label={current ? machineName(current) : mac}
            currentId={mac}
            groupLabel="Switch machine"
            options={(machines ?? []).map((machine) => ({
              id: machine.mac,
              label: machineName(machine),
              hint: machine.ipv4,
            }))}
            onSelect={(next) =>
              void navigate({ to: "/machines/$mac", params: { mac: next } })
            }
          />
        </BreadcrumbItem>
      </Trail>
    )
  }

  if (viewId) {
    const current = views.find((view) => view.id === viewId)
    return (
      <Trail>
        <Crumb to="/">Dashboard</Crumb>
        <BreadcrumbSeparator className="hidden sm:block" />
        <BreadcrumbItem className="hidden sm:inline-flex">Views</BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:block" />
        <BreadcrumbItem>
          <Switcher
            label={current?.name ?? "Unknown view"}
            currentId={viewId}
            groupLabel="Switch view"
            options={views.map((view) => ({
              id: view.id,
              label: view.name,
              hint: `${view.macs.length} machines`,
            }))}
            onSelect={(next) =>
              void navigate({ to: "/views/$viewId", params: { viewId: next } })
            }
          />
        </BreadcrumbItem>
      </Trail>
    )
  }

  const leaf = pathname.startsWith("/machines")
    ? "Machines"
    : pathname.startsWith("/admin")
      ? "Admin"
      : pathname.startsWith("/users")
        ? "Users"
        : pathname.startsWith("/roles")
          ? "Roles"
          : pathname.startsWith("/settings")
            ? "Settings"
            : "Not found"

  return (
    <Trail>
      <Crumb to="/">Dashboard</Crumb>
      <BreadcrumbSeparator className="hidden sm:block" />
      <BreadcrumbItem>
        <BreadcrumbPage>{leaf}</BreadcrumbPage>
      </BreadcrumbItem>
    </Trail>
  )
}

function Trail({ children }: { children: React.ReactNode }) {
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">{children}</BreadcrumbList>
    </Breadcrumb>
  )
}

function Crumb({
  to,
  children,
}: {
  to: "/" | "/machines"
  children: React.ReactNode
}) {
  return (
    <BreadcrumbItem className="hidden sm:inline-flex">
      <BreadcrumbLink render={<Link to={to} />}>{children}</BreadcrumbLink>
    </BreadcrumbItem>
  )
}

interface SwitcherProps {
  label: string
  currentId: string
  groupLabel: string
  options: SwitcherOption[]
  onSelect: (id: string) => void
}

/** The leaf crumb: the current page, and a jump list to its siblings. */
function Switcher({
  label,
  currentId,
  groupLabel,
  options,
  onSelect,
}: SwitcherProps) {
  if (options.length < 2) return <BreadcrumbPage>{label}</BreadcrumbPage>

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="-mx-1 h-6 max-w-52 gap-1 px-1 font-normal text-foreground"
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-56">
        {/* GroupLabel reads its context from Group, so both live together. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onSelect(option.id)}
            >
              <Check
                className={option.id === currentId ? undefined : "opacity-0"}
              />
              <span className="flex-1 truncate">{option.label}</span>
              {option.hint ? (
                <span className="text-xs text-muted-foreground">
                  {option.hint}
                </span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
