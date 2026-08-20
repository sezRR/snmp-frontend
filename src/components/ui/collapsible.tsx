import { cn } from "@/lib/utils"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  )
}

function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden opacity-100 transition-[height,opacity] duration-200 ease-[var(--ease-out)] data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:ease-in data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-opacity motion-reduce:duration-100 motion-reduce:data-ending-style:h-(--collapsible-panel-height) motion-reduce:data-starting-style:h-(--collapsible-panel-height) [&[hidden]:not([hidden='until-found'])]:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
