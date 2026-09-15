import { useState, type ReactNode } from 'react'
import './master-shell.css'

type MasterShellNavItem = {
  id: string
  label: string
  icon: ReactNode
}

type MasterShellProps = {
  children: ReactNode
  title?: string
  userName?: string
  userRole?: string
  locationNode?: string
  activeNav?: string
  onNavigate?: (id: string) => void
}

const Icon = ({ children }: { children: ReactNode }) => (
  <svg aria-hidden="true" className="ws-shell-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
    {children}
  </svg>
)

const navItems: MasterShellNavItem[] = [
  { id: 'social-feed', label: 'Social Feed', icon: <Icon><path d="M4 5.5h16v13H4z" /><path d="M7.5 9h9M7.5 12h6M7.5 15h8" /></Icon> },
  { id: 'work-tracker', label: 'Work Tracker', icon: <Icon><path d="M5 6.5h14v13H5z" /><path d="M9 6.5V4.8h6v1.7M8 11h8M8 15h5" /></Icon> },
  { id: 'personal-diary', label: 'Personal Diary', icon: <Icon><path d="M6 4.5h12v15H6z" /><path d="M9 8h6M9 11.5h6M9 15h4" /></Icon> },
  { id: 'finance-manager', label: 'Finance Manager', icon: <Icon><path d="M4.5 7h15v11.5h-15z" /><path d="M7 7V5h10v2M8 11h8M8 14.5h5" /></Icon> },
]

export function MasterShell({
  children,
  title = 'WORK SOCIAL',
  userName = 'SYSTEM USER',
  userRole = 'COMMAND ACCESS',
  locationNode = 'LOCAL NODE',
  activeNav = 'social-feed',
  onNavigate,
}: MasterShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`ws-master-shell${collapsed ? ' ws-master-shell--collapsed' : ''}`}>
      <aside className="ws-master-sidebar" aria-label="Primary navigation">
        <div className="ws-master-sidebar__top">
          <div className="ws-master-brand">
            <span className="ws-master-core-dot" aria-hidden="true" />
            {!collapsed && (
              <div className="ws-master-brand__copy">
                <span className="ws-heading">WS CORE</span>
                <span>COMMAND DECK</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="ws-master-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              {collapsed ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
            </svg>
          </button>
        </div>

        <nav className="ws-master-nav ws-scrollbar" aria-label="Work Social modules">
          {navItems.map((item) => {
            const active = activeNav === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.id)}
                className={`ws-master-nav__item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span className="ws-master-nav__icon">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="ws-master-sidebar__status">
          <span className="ws-master-status-dot" aria-hidden="true" />
          {!collapsed && <span>SYSTEM ONLINE</span>}
        </div>
      </aside>

      <div className="ws-master-viewport">
        <header className="ws-master-header">
          <div className="ws-glass-panel ws-master-header__panel">
            <div className="ws-master-header__title">
              <h1 className="ws-heading">{title}</h1>
              <div className="ws-master-indicators" aria-label="System status">
                <span className="ws-status-online">● SYSTEM ONLINE</span>
                <span className="ws-muted-text">● CORE STABLE</span>
              </div>
            </div>

            <div className="ws-master-node">
              <span className="ws-master-status-dot" aria-hidden="true" />
              <div>
                <span>LOCATION NODE</span>
                <strong className="ws-mono">{locationNode}</strong>
              </div>
            </div>

            <div className="ws-master-profile">
              <span className="ws-master-avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{userName}</strong>
                <span>{userRole}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="ws-master-content ws-grid ws-scrollbar">
          <div className="ws-master-content__inner">{children}</div>
        </main>
      </div>
    </div>
  )
}
