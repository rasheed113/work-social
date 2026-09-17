import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './hud-components.css'

export type HudButtonVariant = 'primary' | 'secondary' | 'alert'

export type HudButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: HudButtonVariant
}

export function HudButton({ children, className = '', variant = 'primary', ...props }: HudButtonProps) {
  return (
    <button
      {...props}
      className={`ws-hud-button ws-hud-button--${variant}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  )
}
