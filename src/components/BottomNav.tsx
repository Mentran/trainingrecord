import { NavLink, useLocation } from 'react-router-dom'
import { useSport } from './SportProvider'

const tabs = [
  {
    to: '/',
    label: '主页',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2.5 8.5L10 2.5l7.5 6V17a.833.833 0 01-.833.833H13v-4.166H7v4.166H3.333A.833.833 0 012.5 17V8.5z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}
        />
      </svg>
    ),
  },
  {
    to: '/list',
    label: '记录',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="2.5"
          stroke="currentColor" strokeWidth="1.5"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
        />
        <path d="M6.5 7.5h7M6.5 10.5h5.5M6.5 13.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/calendar',
    label: '日历',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2.5" y="4.5" width="15" height="13" rx="2"
          stroke="currentColor" strokeWidth="1.5"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
        />
        <path d="M6.5 2.5v4M13.5 2.5v4M2.5 9h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="7" cy="13" r="1" fill="currentColor"/>
        <circle cx="10" cy="13" r="1" fill="currentColor"/>
        <circle cx="13" cy="13" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/chat',
    label: '顾问',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3.5 3.5h13a.833.833 0 01.833.833v8.334a.833.833 0 01-.833.833H7.5l-4 3V4.333A.833.833 0 013.5 3.5z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
        />
        <path d="M7 8.5h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '设置',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"
          fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}
        />
        <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.1 4.1l1.06 1.06M14.84 14.84l1.06 1.06M4.1 15.9l1.06-1.06M14.84 5.16l1.06-1.06"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const location = useLocation()
  const { sport } = useSport()

  return (
    <nav
      className="fixed bottom-3 left-3 right-3 max-w-lg mx-auto rounded-2xl flex z-30 overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}
    >
      {tabs.map(tab => {
        const active = tab.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(tab.to)
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors"
          >
            {active && (
              <span
                className="absolute inset-x-2 inset-y-1.5 rounded-xl"
                style={{ backgroundColor: sport.accentColor + '1a' }}
              />
            )}
            <span className="relative" style={{ color: active ? sport.accentColor : '#ADADAD' }}>
              {tab.icon(active)}
            </span>
            <span
              className="text-[10px] font-semibold relative"
              style={{ color: active ? sport.accentColor : '#ADADAD' }}
            >
              {tab.label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
