import { expect, test, vi } from 'vitest';
import { Platform, type App } from 'obsidian';
import { SkillLibrary } from './skill-library';
const reveal = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../platform/desktop/skill-files', () => ({ revealSkillFile: reveal }));

test('revealing hidden vault skills uses the desktop location without requiring an indexed Obsidian file', async () => {
	const previous = Platform.isDesktopApp;
	Platform.isDesktopApp = true;
	try {
		const service = new SkillLibrary({
			vault: { adapter: { getBasePath: () => '/test/vault' } },
		} as unknown as App);
		await service.reveal({ kind: 'vault', path: '.codex/skills/review/SKILL.md', agents: ['codex'] });
		expect(reveal).toHaveBeenLastCalledWith('.codex/skills/review/SKILL.md', '/test/vault');
		await service.reveal({ kind: 'directory', path: '/external/skills/review/SKILL.md', agents: ['codex'] });
		expect(reveal).toHaveBeenLastCalledWith('/external/skills/review/SKILL.md', undefined);
	} finally {
		Platform.isDesktopApp = previous;
	}
});
