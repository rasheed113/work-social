import type { InputHTMLAttributes } from 'react'
import './hud-components.css'

export type HudInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export function HudInput({ label, error, id, className = '', ...props }: HudInputProps) {
  return (
    <label className="ws-hud-input" htmlFor={id}>
      {label && <span className="ws-hud-input__label">{label}</span>}
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : props['aria-invalid']}
        className={`ws-hud-input__control${error ? ' is-error' : ''}${className ? ` ${className}` : ''}`}
      />
      {error && <span className="ws-hud-input__error" role="alert">{error}</span>}
    </label>
  )
}
