import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../../../ui/react/test-providers';
import { Dialog, DialogContent, DialogTitle } from '../../../../ui/components/dialog';
import { MarkupToolbar } from './MarkupToolbar';
import { t } from '../../../../shared/i18n';
it('edits ink, thickness and font size without dismissing the drawing dialog', async () => {
	const close = vi.fn(),
		user = userEvent.setup();
	function Drawing() {
		const [color, setColor] = useState('#ef4444'),
			[width, setWidth] = useState(4),
			[fontSize, setFontSize] = useState(18);
		return (
			<TestProviders>
				<Dialog open onOpenChange={close}>
					<DialogContent aria-describedby={undefined}>
						<DialogTitle>Drawing</DialogTitle>
						<MarkupToolbar
							tool="pen"
							onToolChange={() => {}}
							color={color}
							onColorChange={setColor}
							width={width}
							onWidthChange={setWidth}
							fontSize={fontSize}
							onFontSizeChange={setFontSize}
							canUndo={false}
							canRedo={false}
							onUndo={() => {}}
							onRedo={() => {}}
							onClear={() => {}}
						/>
					</DialogContent>
				</Dialog>
			</TestProviders>
		);
	}
	render(<Drawing />);
	await user.click(screen.getByRole('button', { name: t('browser.markupStyle') }));
	await user.click(screen.getByRole('button', { name: '#3b82f6' }));
	await user.click(screen.getByRole('button', { name: t('browser.markupWidthOption', { value: 8 }) }));
	await user.keyboard('{Escape}');
	expect(close).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: t('browser.markupFontSize') }));
	await user.click(screen.getByRole('button', { name: t('browser.markupWidthOption', { value: 32 }) }));
	await user.keyboard('{Escape}');
	expect(close).not.toHaveBeenCalled();
	expect(screen.getByRole('button', { name: t('browser.markupFontSize') }).textContent).toContain('32');
});
