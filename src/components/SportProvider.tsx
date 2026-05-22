import { createContext, useContext, useState, useCallback } from 'react'
import type { Sport } from '../types'
import { getActiveSport, getActiveSportId, setActiveSportId, getSports } from '../lib/storage'

interface SportContextValue {
  sport: Sport
  sports: Sport[]
  switchSport: (id: string) => void
  refreshSports: () => void
}

const SportContext = createContext<SportContextValue>({
  sport: { id: 'tennis', name: '网球', icon: '🎾', color: '#1A2E1A', accentColor: '#9DC41A', createdAt: '' },
  sports: [],
  switchSport: () => {},
  refreshSports: () => {},
})

export function useSport() {
  return useContext(SportContext)
}

export function SportProvider({ children }: { children: React.ReactNode }) {
  const [sport, setSport] = useState<Sport>(getActiveSport)
  const [sports, setSports] = useState<Sport[]>(getSports)

  const switchSport = useCallback((id: string) => {
    setActiveSportId(id)
    const all = getSports()
    const next = all.find(s => s.id === id) ?? all[0]
    setSport(next)
    setSports(all)
  }, [])

  const refreshSports = useCallback(() => {
    const all = getSports()
    setSports(all)
    const current = all.find(s => s.id === getActiveSportId()) ?? all[0]
    setSport(current)
  }, [])

  return (
    <SportContext.Provider value={{ sport, sports, switchSport, refreshSports }}>
      {children}
    </SportContext.Provider>
  )
}
