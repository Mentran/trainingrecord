import { useMemo, useSyncExternalStore } from 'react'
import { getActiveSportId, getRecords, getSports, getTechniques } from '../lib/storage'
import { getStorageRevision, subscribeStorage } from '../lib/storageEvents'

export function useStorageRevision(): number {
  return useSyncExternalStore(subscribeStorage, getStorageRevision, getStorageRevision)
}

export function useRecords(sportId?: string) {
  const revision = useStorageRevision()
  return useMemo(() => readRecords(revision, sportId), [revision, sportId])
}

export function useTechniques(sportId?: string) {
  const revision = useStorageRevision()
  return useMemo(() => readTechniques(revision, sportId), [revision, sportId])
}

export function useSports() {
  const revision = useStorageRevision()
  return useMemo(() => readSports(revision), [revision])
}

export function useActiveSportId() {
  const revision = useStorageRevision()
  return useMemo(() => readActiveSportId(revision), [revision])
}

export function useCoaches(sportId?: string) {
  const records = useRecords(sportId)
  return useMemo(() => {
    const seen = new Set<string>()
    return records.flatMap(record => {
      if (!record.coach || seen.has(record.coach)) return []
      seen.add(record.coach)
      return [record.coach]
    })
  }, [records])
}

function readRecords(_revision: number, sportId?: string) {
  void _revision
  return getRecords(sportId)
}

function readTechniques(_revision: number, sportId?: string) {
  void _revision
  return getTechniques(sportId)
}

function readSports(_revision: number) {
  void _revision
  return getSports()
}

function readActiveSportId(_revision: number) {
  void _revision
  return getActiveSportId()
}
