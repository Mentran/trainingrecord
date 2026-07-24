import { useCallback } from 'react'
import { DEFAULT_SPORT, setActiveSportId } from '../lib/storage'
import { useActiveSportId, useSports } from '../hooks/useLocalData'
import { SportContext } from '../contexts/SportContext'

export function SportProvider({ children }: { children: React.ReactNode }) {
  const sports = useSports()
  const activeSportId = useActiveSportId()
  const sport = sports.find(item => item.id === activeSportId) ?? sports[0] ?? DEFAULT_SPORT

  const switchSport = useCallback((id: string) => {
    setActiveSportId(id)
  }, [])

  return (
    <SportContext.Provider value={{ sport, sports, switchSport }}>
      {children}
    </SportContext.Provider>
  )
}
