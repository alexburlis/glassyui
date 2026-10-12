"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full px-0.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 data-[size=default]:h-7 data-[size=default]:w-[60px] data-[size=sm]:h-6 data-[size=sm]:w-[46px]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:h-6 group-data-[size=default]/switch:w-9 group-data-[size=sm]/switch:h-5 group-data-[size=sm]/switch:w-7 data-[state=unchecked]:translate-x-0 group-data-[size=default]/switch:data-[state=checked]:translate-x-5 group-data-[size=sm]/switch:data-[state=checked]:translate-x-3.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
