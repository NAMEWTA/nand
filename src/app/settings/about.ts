import { t } from '../../shared/i18n/index';

/** Settings → About: who builds NAND and how to reach them. */
export function renderAbout(containerEl: HTMLElement): void {
	const wrap = containerEl.createDiv({ cls: 'dashboard-about' });

	wrap.createDiv({ cls: 'dashboard-about-intro-line1', text: t('about.intro1') });
	wrap.createDiv({ cls: 'dashboard-about-intro-line', text: t('about.intro2') });
	wrap.createDiv({ cls: 'dashboard-about-intro-line', text: t('about.intro3') });

	wrap.createDiv({ cls: 'dashboard-about-divider' });

	const projects: Array<[string, string]> = [
		[t('about.projNand'), t('about.projNandDesc')],
		[t('about.projWta'), t('about.projWtaDesc')],
	];
	section(wrap, t('about.building'), (body) => {
		for (const [name, desc] of projects) {
			const row = body.createDiv({ cls: 'dashboard-about-project' });
			row.createSpan({ cls: 'dashboard-about-project-name', text: name });
			row.createSpan({ cls: 'dashboard-about-project-sep', text: '｜' });
			row.createSpan({ cls: 'dashboard-about-project-desc', text: desc });
		}
	});

	section(wrap, t('about.contact'), (body) => {
		const ghRow = body.createDiv({ cls: 'dashboard-about-contact-row' });
		ghRow.createSpan({ cls: 'dashboard-about-contact-label', text: 'GitHub：' });
		ghRow.createEl('a', {
			cls: 'dashboard-about-link',
			text: t('about.githubUser'),
			attr: { href: 'https://github.com/NAMEWTA' },
		});
	});
}

function section(wrap: HTMLElement, heading: string, fill: (section: HTMLElement) => void): void {
	const el = wrap.createDiv({ cls: 'dashboard-about-section' });
	el.createDiv({ cls: 'dashboard-about-section-title', text: heading });
	fill(el);
}
