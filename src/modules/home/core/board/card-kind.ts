/** The same precedence is used by rendered cards and background task delivery. */
export function cardKind(section: string, type: string): 'memo' | 'task' | 'project' {
  return section === 'memo' || (section === 'sticky' && (type === 'generic' || type === 'note'))
    ? 'memo' : type === 'task' || section === 'todo' ? 'task' : 'project';
}
const querySections = new Set(['library', 'folder', 'alltasks', 'calendar', 'dataview', 'weread', 'images', 'videos', 'web', 'dashboard']);
export function canReceiveTask(column: { name: string; sectionType?: string }, card: { type: string }): boolean {
  const section = column.sectionType ?? column.name.toLowerCase();
  return !querySections.has(section) && !['weather', 'tracker', 'web'].includes(card.type) && cardKind(section, card.type) === 'task';
}
