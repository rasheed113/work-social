import type { HTMLAttributes, ReactNode } from 'react'
import './hud-components.css'

export type HudBadgeTone = 'cyan' | 'blue' | 'alert' | 'muted'

export type HudBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: HudBadgeTone
  dot?: boolean
}

export function HudBadge({ children, className = '', tone = 'cyan', dot = true, ...props }: HudBadgeProps) {
  return (
    <span {...props} className={`ws-hud-badge ws-hud-badge--${tone}${className ? ` ${className}` : ''}`}>
      {dot && <span className="ws-hud-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}
