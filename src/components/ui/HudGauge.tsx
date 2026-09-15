import type { CSSProperties, HTMLAttributes } from 'react'
import './hud-components.css'

export type HudGaugeProps = HTMLAttributes<HTMLDivElement> & {
  value: number
  max?: number
  size?: number
  label?: string
  showValue?: boolean
}

export function HudGauge({ value, max = 100, size = 96, label, showValue = true, className = '', style, ...props }: HudGaugeProps) {
  const safeMax = max > 0 ? max : 100
  const ratio = Math.min(1, Math.max(0, value / safeMax))
  const percentage = Math.round(ratio * 100)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - ratio)
  const gaugeStyle = { '--ws-gauge-size': `${size}px`, ...style } as CSSProperties

  return (
    <div {...props} className={`ws-hud-gauge${className ? ` ${className}` : ''}`} style={gaugeStyle}>
      <svg className="ws-hud-gauge__svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ws-hud-gauge__track" cx="50" cy="50" r={radius} />
        <circle
          className="ws-hud-gauge__progress"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ws-hud-gauge__value">
        {showValue && <strong>{percentage}%</strong>}
        {label && <span>{label}</span>}
      </div>
    </div>
  )
}
