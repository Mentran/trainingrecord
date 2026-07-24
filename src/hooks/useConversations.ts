import { useMemo } from 'react'
import { getConversations } from '../lib/ai'
import { useStorageRevision } from './useLocalData'

export function useConversations(sportId?: string) {
  const revision = useStorageRevision()
  return useMemo(() => readConversations(revision, sportId), [revision, sportId])
}

function readConversations(_revision: number, sportId?: string) {
  void _revision
  return getConversations(sportId)
}
