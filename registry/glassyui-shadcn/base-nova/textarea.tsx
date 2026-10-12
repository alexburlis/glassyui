import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[16px] border px-5 py-3.5 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-destructive focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-[rgb(var(--glassy-glass)/var(--glassy-control-alpha))]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
