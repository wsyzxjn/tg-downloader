import type { PropsWithChildren } from "react"
import { cn } from "@/lib/utils"

interface AppSectionCardProps extends PropsWithChildren {
  title: string
  className?: string
  headerClassName?: string
  contentClassName?: string
  titleClassName?: string
}

export function AppSectionCard({
  children,
  className,
  contentClassName,
  headerClassName,
  title,
  titleClassName,
}: AppSectionCardProps) {
  return (
    <section className={cn("rounded-md border border-border/60 bg-background", className)}>
      <div className={cn("px-6 pt-6", headerClassName)}>
        <h2 className={cn("text-base font-semibold tracking-tight", titleClassName)}>{title}</h2>
      </div>
      <div className={cn("px-6 pb-6 pt-4", contentClassName)}>{children}</div>
    </section>
  )
}
