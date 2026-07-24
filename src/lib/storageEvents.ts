type StorageListener = () => void

const listeners = new Set<StorageListener>()
let revision = 0
let listeningToBrowserStorage = false

function handleBrowserStorage(): void {
  emitStorageChange()
}

function ensureBrowserStorageListener(): void {
  if (listeningToBrowserStorage || typeof window === 'undefined') return
  window.addEventListener('storage', handleBrowserStorage)
  listeningToBrowserStorage = true
}

export function emitStorageChange(): void {
  revision += 1
  listeners.forEach(listener => listener())
}

export function subscribeStorage(listener: StorageListener): () => void {
  ensureBrowserStorageListener()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getStorageRevision(): number {
  return revision
}
