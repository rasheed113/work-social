import type { HTMLAttributes, ReactNode } from 'react'
import './hud-components.css'

export type HudCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  interactive?: boolean
}

export function HudCard({ children, className = '', interactive = true, ...props }: HudCardProps) {
  return (
    <div
      {...props}
      className={`ws-hud-card${interactive ? ' ws-hud-card--interactive' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}
