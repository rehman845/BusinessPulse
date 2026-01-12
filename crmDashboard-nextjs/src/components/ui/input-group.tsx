import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/cn"
import { Button } from "@/components/ui/button"

type ButtonProps = React.ComponentProps<typeof Button>

const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex min-w-0 items-stretch focus-within:z-10",
        className
      )}
      {...props}
    />
  )
})
InputGroup.displayName = "InputGroup"

const inputGroupAddonVariants = cva(
  "pointer-events-none absolute z-10 flex items-center gap-1.5 px-3 text-muted-foreground peer-disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      align: {
        "inline-start": "inset-y-0 start-0",
        "inline-end": "inset-y-0 end-0",
        "block-start": "inset-x-0 top-0 justify-end py-2",
        "block-end": "inset-x-0 bottom-0 justify-end py-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

const InputGroupAddon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof inputGroupAddonVariants>
>(({ className, align, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(inputGroupAddonVariants({ align }), className)}
      {...props}
    />
  )
})
InputGroupAddon.displayName = "InputGroupAddon"

const InputGroupButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", size = "sm", ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn("pointer-events-auto", className)}
        {...props}
      />
    )
  }
)
InputGroupButton.displayName = "InputGroupButton"

const InputGroupInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      data-slot="input-group-control"
      className={cn(
        "peer flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-[color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
InputGroupInput.displayName = "InputGroupInput"

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
}

