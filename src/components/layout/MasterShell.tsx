import { useState, type ReactNode } from 'react'

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
  <svg
    aria-hidden="true"
    className="h-5 w-5 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 24 24"
  >
    {children}
  </svg>
)

const navItems: MasterShellNavItem[] = [
  {
    id: 'social-feed',
    label: 'Social Feed',
    icon: (
      <Icon>
        <path d="M4 5.5h16v13H4z" />
        <path d="M7.5 9h9M7.5 12h6M7.5 15h8" />
      </Icon>
    ),
  },
  {
    id: 'work-tracker',
    label: 'Work Tracker',
    icon: (
      <Icon>
        <path d="M5 6.5h14v13H5z" />
        <path d="M9 6.5V4.8h6v1.7M8 11h8M8 15h5" />
      </Icon>
    ),
  },
  {
    id: 'personal-diary',
    label: 'Personal Diary',
    icon: (
      <Icon>
        <path d="M6 4.5h12v15H6z" />
        <path d="M9 8h6M9 11.5h6M9 15h4" />
      </Icon>
    ),
  },
  {
    id: 'finance-manager',
    label: 'Finance Manager',
    icon: (
      <Icon>
        <path d="M4.5 7h15v11.5h-15z" />
        <path d="M7 7V5h10v2M8 11h8M8 14.5h5" />
      </Icon>
    ),
  },
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
    <div className="min-h-screen bg-ws-deep text-ws-text-primary">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-cyan/20 bg-[var(--ws-glass-bg)] backdrop-blur-ws transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[76px]' : 'w-[260px]'
        }`}
        aria-label="Primary navigation"
      >
        <div className="flex h-16 items-center border-b border-cyan/20 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ws-md border border-cyan/30 text-ws-cyan shadow-ws-cyan">
              <span className="h-2.5 w-2.5 rounded-full bg-ws-cyan shadow-[0_0_12px_var(--ws-cyan)]" />
            </span>

            {!collapsed && (
              <div className="min-w-0">
                <p className="ws-heading truncate text-xs text-ws-cyan">WS CORE</p>
                <p className="truncate text-[10px] tracking-[0.16em] text-ws-text-muted">COMMAND DECK</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ws-md border border-cyan/20 text-ws-cyan transition hover:border-cyan/45 hover:shadow-ws-cyan"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              {collapsed ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
            </svg>
          </button>
        </div>

        <nav className="ws-scrollbar flex-1 space-y-2 overflow-y-auto p-3" aria-label="Work Social modules">
          {navItems.map((item) => {
            const active = activeNav === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.id)}
                className={`group flex w-full items-center gap-3 rounded-ws-md border px-3 py-3 text-left transition ${
                  active
                    ? 'border-cyan/40 bg-cyan/[0.08] text-ws-cyan shadow-ws-cyan'
                    : 'border-transparent text-ws-text-muted hover:border-cyan/20 hover:bg-cyan/[0.04] hover:text-ws-cyan'
                }`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span className={active ? 'text-ws-cyan drop-shadow-[0_0_7px_var(--ws-cyan)]' : 'text-ws-cyan/75 group-hover:text-ws-cyan'}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate text-sm font-medium">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-cyan/20 p-3">
          <div className={`rounded-ws-md border border-cyan/15 bg-black/10 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
            <span className="block h-2 w-2 rounded-full bg-ws-cyan shadow-[0_0_10px_var(--ws-cyan)]" title="System online" />
            {!collapsed && (
              <p className="mt-2 text-[10px] font-medium tracking-[0.14em] text-ws-text-muted">SYSTEM ONLINE</p>
            )}
          </div>
        </div>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-200 ease-out ${collapsed ? 'pl-[76px]' : 'pl-[260px]'}`}>
        <header className="sticky top-0 z-40 px-4 pt-4">
          <div className="ws-glass-panel flex min-h-16 items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <h1 className="ws-heading truncate text-sm text-white sm:text-base">{title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] tracking-[0.12em]">
                <span className="ws-status-online">● SYSTEM ONLINE</span>
                <span className="text-ws-text-muted">● CORE STABLE</span>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-ws-md border border-cyan/15 px-3 py-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-ws-cyan shadow-[0_0_10px_var(--ws-cyan)]" />
              <div>
                <p className="text-[9px] tracking-[0.14em] text-ws-text-muted">LOCATION NODE</p>
                <p className="ws-mono text-[10px] text-ws-cyan">{locationNode}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-ws-md border border-cyan/15 bg-black/10 px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan/30 text-xs font-semibold text-ws-cyan shadow-ws-cyan">
                {userName.slice(0, 1).toUpperCase()}
              </span>
              <div className="hidden min-w-0 md:block">
                <p className="max-w-32 truncate text-xs font-semibold text-white">{userName}</p>
                <p className="max-w-32 truncate text-[9px] tracking-[0.1em] text-ws-text-muted">{userRole}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="ws-scrollbar ws-grid min-h-[calc(100vh-5rem)] overflow-y-auto px-4 pb-6 pt-4">
          <div className="mx-auto min-h-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
