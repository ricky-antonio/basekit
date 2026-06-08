"use client"

import { useFormStatus } from "react-dom"
import { demoLoginAction } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import type { ComponentProps } from "react"

type ButtonVariant = ComponentProps<typeof Button>["variant"]
type ButtonSize = ComponentProps<typeof Button>["size"]

interface DemoLoginButtonProps {
  label?: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

function SubmitButton({ label, variant, size, className }: Required<Pick<DemoLoginButtonProps, "label">> & DemoLoginButtonProps) {
  // Redirect button: stays in its pending state until the browser navigates away.
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className}>
      {pending ? "Entering demo…" : label}
    </Button>
  )
}

export default function DemoLoginButton({
  label = "Explore the demo",
  variant = "outline",
  size = "lg",
  className,
}: DemoLoginButtonProps) {
  return (
    <form action={demoLoginAction} className="contents">
      <SubmitButton label={label} variant={variant} size={size} className={className} />
    </form>
  )
}
