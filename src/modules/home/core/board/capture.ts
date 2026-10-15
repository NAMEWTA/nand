// Adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), src/quick-note-section.ts
/** Preserve frontmatter and list boundaries when inserting a captured thought. */
export function placeCaptureLine(raw: string, line: string, position: 'start' | 'end'): string {
 if (position === 'end') return `${raw}${raw === '' || raw.endsWith('\n') ? '' : '\n'}${line}\n`;
 const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
 const fm = match?.[0] ?? '', body = raw.slice(fm.length);
 return `${fm}${fm && !fm.endsWith('\n') ? '\n' : ''}${line}\n${body && !body.startsWith('\n') ? '\n' : ''}${body}`;
}
