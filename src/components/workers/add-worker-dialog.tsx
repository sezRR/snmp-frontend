import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/client"
import {
  type SecurityLevel,
  type SnmpVersion,
  type WorkerCreate,
  authProtocolSchema,
  privProtocolSchema,
  workerCreateSchema,
} from "@/lib/api/types"
import { useCreateWorkerMutation } from "@/lib/queries/workers"
import { useNavigate } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

const securityLevelItems: Record<SecurityLevel, string> = {
  noAuthNoPriv: "No auth, no privacy",
  authNoPriv: "Auth, no privacy",
  authPriv: "Auth + privacy",
}

const initialForm = {
  ip: "",
  name: "",
  community: "",
  username: "",
  security_level: "authPriv" as SecurityLevel,
  auth_protocol: "SHA",
  auth_password: "",
  priv_protocol: "AES128",
  priv_password: "",
}

export function AddWorkerDialog() {
  const [open, setOpen] = React.useState(false)
  const [version, setVersion] = React.useState<SnmpVersion>("v2c")
  const [form, setForm] = React.useState(initialForm)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const navigate = useNavigate()
  const mutation = useCreateWorkerMutation()

  const needsAuth = form.security_level !== "noAuthNoPriv"
  const needsPriv = form.security_level === "authPriv"

  const set = (key: keyof typeof initialForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const reset = () => {
    setForm(initialForm)
    setVersion("v2c")
    setErrors({})
    mutation.reset()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const candidate =
      version === "v2c"
        ? {
            snmp_version: "v2c" as const,
            ip: form.ip.trim(),
            name: form.name.trim() || undefined,
            v2c: { community: form.community.trim() || "public" },
          }
        : {
            snmp_version: "v3" as const,
            ip: form.ip.trim(),
            name: form.name.trim() || undefined,
            v3: {
              username: form.username.trim(),
              security_level: form.security_level,
              ...(needsAuth && {
                auth_protocol: authProtocolSchema.parse(form.auth_protocol),
                auth_password: form.auth_password,
              }),
              ...(needsPriv && {
                priv_protocol: privProtocolSchema.parse(form.priv_protocol),
                priv_password: form.priv_password,
              }),
            },
          }

    const result = workerCreateSchema.safeParse(candidate)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join(".")
        fieldErrors[key] ??= issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    mutation.mutate(result.data satisfies WorkerCreate, {
      onSuccess: (worker) => {
        toast.success(`Worker ${worker.name ?? worker.ip} added`)
        setOpen(false)
        reset()
        void navigate({
          to: "/workers/$workerId",
          params: { workerId: worker.id },
        })
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus data-icon="inline-start" />
            Add worker
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add SNMP worker</DialogTitle>
          <DialogDescription>
            Register a machine to monitor via its SNMP agent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={errors.ip ? true : undefined}>
              <FieldLabel htmlFor="worker-ip">IP address</FieldLabel>
              <Input
                id="worker-ip"
                placeholder="192.168.1.10"
                value={form.ip}
                aria-invalid={errors.ip ? true : undefined}
                onChange={(e) => set("ip")(e.target.value)}
              />
              {errors.ip ? <FieldError>{errors.ip}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="worker-name">Name (optional)</FieldLabel>
              <Input
                id="worker-name"
                placeholder="core-switch-01"
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>SNMP version</FieldLabel>
              <Select
                value={version}
                onValueChange={(value) => setVersion(value as SnmpVersion)}
                items={{ v2c: "v2c", v3: "v3" }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="v2c">v2c</SelectItem>
                    <SelectItem value="v3">v3</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            {version === "v2c" ? (
              <Field>
                <FieldLabel htmlFor="worker-community">
                  Community (optional)
                </FieldLabel>
                <Input
                  id="worker-community"
                  placeholder="public"
                  value={form.community}
                  onChange={(e) => set("community")(e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field data-invalid={errors["v3.username"] ? true : undefined}>
                  <FieldLabel htmlFor="worker-username">Username</FieldLabel>
                  <Input
                    id="worker-username"
                    value={form.username}
                    aria-invalid={errors["v3.username"] ? true : undefined}
                    onChange={(e) => set("username")(e.target.value)}
                  />
                  {errors["v3.username"] ? (
                    <FieldError>{errors["v3.username"]}</FieldError>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel>Security level</FieldLabel>
                  <Select
                    value={form.security_level}
                    onValueChange={(value) =>
                      set("security_level")(value as SecurityLevel)
                    }
                    items={securityLevelItems}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.entries(securityLevelItems).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {needsAuth ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Auth protocol</FieldLabel>
                      <Select
                        value={form.auth_protocol}
                        onValueChange={(value) =>
                          set("auth_protocol")(value as string)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {authProtocolSchema.options.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      data-invalid={
                        errors["v3.auth_password"] ? true : undefined
                      }
                    >
                      <FieldLabel htmlFor="worker-auth-password">
                        Auth password
                      </FieldLabel>
                      <Input
                        id="worker-auth-password"
                        type="password"
                        value={form.auth_password}
                        aria-invalid={
                          errors["v3.auth_password"] ? true : undefined
                        }
                        onChange={(e) => set("auth_password")(e.target.value)}
                      />
                      {errors["v3.auth_password"] ? (
                        <FieldError>{errors["v3.auth_password"]}</FieldError>
                      ) : null}
                    </Field>
                  </div>
                ) : null}
                {needsPriv ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Privacy protocol</FieldLabel>
                      <Select
                        value={form.priv_protocol}
                        onValueChange={(value) =>
                          set("priv_protocol")(value as string)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {privProtocolSchema.options.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      data-invalid={
                        errors["v3.priv_password"] ? true : undefined
                      }
                    >
                      <FieldLabel htmlFor="worker-priv-password">
                        Privacy password
                      </FieldLabel>
                      <Input
                        id="worker-priv-password"
                        type="password"
                        value={form.priv_password}
                        aria-invalid={
                          errors["v3.priv_password"] ? true : undefined
                        }
                        onChange={(e) => set("priv_password")(e.target.value)}
                      />
                      {errors["v3.priv_password"] ? (
                        <FieldError>{errors["v3.priv_password"]}</FieldError>
                      ) : null}
                    </Field>
                  </div>
                ) : null}
              </>
            )}

            {mutation.isError ? (
              <FieldError>
                {mutation.error instanceof ApiError
                  ? mutation.error.message
                  : "Failed to add worker"}
              </FieldError>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Add worker
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
