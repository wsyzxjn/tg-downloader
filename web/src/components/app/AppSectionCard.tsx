import type { PropsWithChildren, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppSectionCardProps extends PropsWithChildren {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  titleClassName?: string
}

export function AppSectionCard({
  action,
  children,
  className,
  contentClassName,
  headerClassName,
  subtitle,
  title,
  titleClassName,
}: AppSectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border/60 bg-card text-card-foreground shadow-2xs transition-colors",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-1.5 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6",
          headerClassName
        )}
      >
        <div className="space-y-0.5">
          <h2
            className={cn("text-base font-semibold tracking-tight text-foreground", titleClassName)}
          >
            {title}
          </h2>
          {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      <div className={cn("px-5 pb-5 pt-4 sm:px-6 sm:pb-6", contentClassName)}>{children}</div>
    </section>
  )
}
