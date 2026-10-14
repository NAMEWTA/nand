import { Fragment, StrictMode, useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { Input } from '../components/input';
import { Textarea } from '../components/textarea';
import { Button } from '../components/button';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '../components/dialog';
import { InlineRename } from '../components/nand/InlineRename';
import { ConfirmDialog } from '../components/nand/ConfirmDialog';
import { ContainerProviders } from './providers';
import { usePortalContainer } from './contexts';
import { TestProviders } from './test-providers';
import { acquirePortalRoot, releasePortalRoot } from './portal';
import { toast } from '../components/sonner';
import { cn } from '../lib/utils';
import { useT } from './hooks';

const frameDocs: HTMLIFrameElement[] = [];
afterEach(() => {
	vi.restoreAllMocks();
	for (const frame of frameDocs.splice(0)) frame.remove();
	setLanguage('zh');
});

describe('React foundation', () => {
	it.each([Input, Textarea])('does not submit IME Enter and preserves consumer composition handlers', (Field) => {
		const submit = vi.fn();
		const down = vi.fn();
		const start = vi.fn();
		const end = vi.fn();
		render(
			<TestProviders>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
					onKeyDown={down}
				>
					<Field
						aria-label="editor"
						onCompositionStart={start}
						onCompositionEnd={end}
						onKeyDown={(event) => {
							if (event.key === 'Enter') submit();
						}}
					/>
				</form>
			</TestProviders>,
		);
		const field = screen.getByRole('textbox');
		fireEvent.compositionStart(field);
		expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false);
		expect(submit).not.toHaveBeenCalled();
		expect(down).not.toHaveBeenCalled();
		fireEvent.compositionEnd(field);
		fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
		expect(submit).not.toHaveBeenCalled();
		fireEvent.keyDown(field, { key: 'Enter' });
		expect(submit).toHaveBeenCalledOnce();
		expect(start).toHaveBeenCalledOnce();
		expect(end).toHaveBeenCalledOnce();
	});
	it('reference counts per document and never removes another window root', () => {
		const frame = document.createElement('iframe');
		document.body.append(frame);
		frameDocs.push(frame);
		const other = frame.contentDocument!;
		// Each window has its own HTMLElement prototype, as in Obsidian popouts.
		const createDiv = (options?: { cls?: string }) => {
			const el = other.createElement('div');
			el.className = options?.cls ?? '';
			other.body.append(el);
			return el;
		};
		Object.defineProperty(other.body, 'createDiv', { value: createDiv });
		const first = acquirePortalRoot(document);
		const same = acquirePortalRoot(document);
		const second = acquirePortalRoot(other);
		expect(same).toBe(first);
		expect(second.ownerDocument).toBe(other);
		releasePortalRoot(document);
		expect(first.isConnected).toBe(true);
		releasePortalRoot(document);
		expect(first.isConnected).toBe(false);
		expect(second.isConnected).toBe(true);
		releasePortalRoot(other);
		expect(second.isConnected).toBe(false);
	});
	it.each([false, true])(
		'preserves drafts and page lifetime across adoption and return (StrictMode=%s)',
		async (strict) => {
			const frame = document.createElement('iframe');
			document.body.append(frame);
			frameDocs.push(frame);
			const other = frame.contentDocument!;
			Object.defineProperty(other.body, 'createDiv', {
				value: (options?: { cls?: string }) => {
					const el = other.createElement('div');
					el.className = options?.cls ?? '';
					other.body.append(el);
					return el;
				},
			});
			const container = document.createElement('div');
			document.body.append(container);
			const buttonRef = { current: null as HTMLButtonElement | null };
			const mounts = vi.fn();
			const unmounts = vi.fn();
			function Probe() {
				const portal = usePortalContainer();
				const [draft, setDraft] = useState('original');
				useEffect(() => {
					mounts();
					return () => {
						unmounts();
					};
				}, []);
				return (
					<>
						<span data-document>{portal.ownerDocument === other ? 'popout' : 'main'}</span>
						<Input
							aria-label="controlled"
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
						/>
						<Input aria-label="uncontrolled" defaultValue="original" />
						<Button size="icon-xs" ref={buttonRef}>
							X
						</Button>
					</>
				);
			}
			const Mode = strict ? StrictMode : Fragment;
			const result = render(
				<Mode>
					<ContainerProviders container={container}>
						<Probe />
					</ContainerProviders>
				</Mode>,
				{ container },
			);
			const button = container.querySelector('button')!;
			expect(buttonRef.current).toBe(button);
			const inputs = Array.from(container.querySelectorAll('input'));
			for (const input of inputs) fireEvent.change(input, { target: { value: 'unsaved draft' } });
			expect(mounts).toHaveBeenCalledTimes(strict ? 2 : 1);
			expect(unmounts).toHaveBeenCalledTimes(strict ? 1 : 0);
			for (const [target, name, previous] of [
				[other, 'popout', document],
				[document, 'main', other],
			] as const) {
				await act(async () => {
					target.body.append(container);
				});
				await waitFor(() => expect(container.querySelector('[data-document]')?.textContent).toBe(name));
				expect(Array.from(container.querySelectorAll('input'))).toEqual(inputs);
				for (const input of inputs) expect(input.value).toBe('unsaved draft');
				expect(mounts).toHaveBeenCalledTimes(strict ? 2 : 1);
				expect(unmounts).toHaveBeenCalledTimes(strict ? 1 : 0);
				expect(buttonRef.current).toBe(button);
				expect(previous.querySelector('.nand-portal-root')).toBeNull();
				expect(target.querySelectorAll('.nand-portal-root')).toHaveLength(1);
			}
			result.unmount();
			expect(buttonRef.current).toBeNull();
			expect(unmounts).toHaveBeenCalledTimes(strict ? 2 : 1);
			expect(document.querySelector('.nand-portal-root')).toBeNull();
			expect(other.querySelector('.nand-portal-root')).toBeNull();
		},
	);
	it('strict mounting shares one portal and one toaster, then transfers ownership', async () => {
		const first = render(
			<StrictMode>
				<TestProviders>
					<Button>First</Button>
				</TestProviders>
			</StrictMode>,
		);
		const second = render(
			<TestProviders>
				<Button>Second</Button>
			</TestProviders>,
		);
		act(() => {
			toast('test notification', { duration: Infinity });
		});
		await screen.findByText('test notification');
		expect(document.querySelectorAll('.nand-portal-root')).toHaveLength(1);
		expect(document.querySelectorAll('[data-sonner-toaster]')).toHaveLength(1);
		first.unmount();
		act(() => {
			toast('transferred notification', { duration: Infinity });
		});
		await screen.findByText('transferred notification');
		await waitFor(() => expect(document.querySelectorAll('[data-sonner-toaster]')).toHaveLength(1));
		act(() => {
			toast.dismiss();
		});
		second.unmount();
		expect(document.querySelectorAll('.nand-portal-root')).toHaveLength(0);
	});
	it('ports dialogs into the scoped container and returns keyboard focus to their trigger', async () => {
		const user = userEvent.setup();
		render(
			<TestProviders>
				<Dialog>
					<DialogTrigger asChild>
						<Button>Open</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogTitle>Title</DialogTitle>
						<DialogDescription>Description</DialogDescription>
						<Input aria-label="name" />
					</DialogContent>
				</Dialog>
			</TestProviders>,
		);
		await user.click(screen.getByRole('button', { name: 'Open' }));
		expect(screen.getByRole('dialog').closest('.nand-portal-root')).not.toBeNull();
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }));
	});
	it('language changes rerender labels without clearing the input draft', () => {
		function Form() {
			const t = useT();
			return (
				<>
					<Button>{t('ui.save')}</Button>
					<Input aria-label="draft" defaultValue="original" />
				</>
			);
		}
		render(
			<TestProviders>
				<Form />
			</TestProviders>,
		);
		fireEvent.change(screen.getByRole('textbox'), { target: { value: 'draft' } });
		act(() => setLanguage('en'));
		expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
		expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('draft');
	});
	it('keeps failed rename drafts and does not commit Escape', async () => {
		const rename = vi.fn().mockRejectedValue(new Error('disk unavailable'));
		render(
			<TestProviders>
				<InlineRename value="before" onRename={rename} />
			</TestProviders>,
		);
		fireEvent.click(screen.getByRole('button'));
		fireEvent.change(screen.getByRole('textbox'), { target: { value: 'after' } });
		fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
		await screen.findByRole('alert');
		expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('after');
		fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
		expect(rename).toHaveBeenCalledOnce();
	});
	it('retains the confirmation dialog and displays errors until the action succeeds', async () => {
		const confirm = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(undefined);
		render(
			<TestProviders>
				<ConfirmDialog
					title="Delete"
					description="Confirm deletion"
					confirmLabel="Continue"
					onConfirm={confirm}
				>
					<Button>Open</Button>
				</ConfirmDialog>
			</TestProviders>,
		);
		fireEvent.click(screen.getByRole('button', { name: 'Open' }));
		fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
		await screen.findByRole('alert');
		expect(screen.getByRole('alertdialog')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
	});
	it('keeps custom text sizes when merging foreground colors', () => {
		expect(cn('text-2xs', 'text-muted-foreground')).toBe('text-2xs text-muted-foreground');
		expect(cn('text-3xs', 'text-foreground')).toBe('text-3xs text-foreground');
	});
});
