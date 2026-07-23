import { createContext, useContext } from 'react'
import type { Sport } from '../types'

export interface SportContextValue {
  sport: Sport
  sports: Sport[]
  switchSport: (id: string) => void
  refreshSports: () => void
}

export const SportContext = createContext<SportContextValue>({
  sport: { id: 'tennis', name: '网球', icon: '🎾', color: '#1A2E1A', accentColor: '#9DC41A', categories: [], level: '2.0', createdAt: '' },
  sports: [],
  switchSport: () => {},
  refreshSports: () => {},
})

export function useSport() {
  return useContext(SportContext)
}
