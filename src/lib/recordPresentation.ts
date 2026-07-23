const COACH_COLORS = ['#E8A838', '#4A90D9', '#E85D5D', '#9B59B6', '#1ABC9C']

export function getCoachColor(coach: string, allCoaches: string[]): string {
  const index = allCoaches.indexOf(coach)
  return COACH_COLORS[index % COACH_COLORS.length] ?? '#9DC41A'
}
