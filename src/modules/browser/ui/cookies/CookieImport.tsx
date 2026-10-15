// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/browser-pane/assemble-chrome/browser-toolbar-menu-dropdown.tsx, src/renderer/src/components/BrowserCookieImportDisclosure.tsx, BrowserCookieImportMachineNotice.tsx
import { useEffect, useState } from 'react';
import { Import } from 'lucide-react';
import { toast } from 'sonner';
import type { BrowserEngine } from '../../services/host';
import type { CookieImportResult, DetectedBrowser } from '../../core/cookies';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from '../../../../ui/components/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../ui/components/dialog';
export function CookieImport({
	host,
	profileId,
	compact = false,
	initiallyOpen = false,
}: {
	host: BrowserEngine;
	profileId: string;
	compact?: boolean;
	initiallyOpen?: boolean;
}) {
	const t = useT(),
		[sources, setSources] = useState<DetectedBrowser[]>([]),
		[loading, setLoading] = useState(initiallyOpen),
		[busy, setBusy] = useState(false),
		[details, setDetails] = useState('');
	useEffect(() => {
		if (initiallyOpen)
			void host
				.detectBrowsers()
				.then(setSources)
				.catch((error) => setDetails(String(error)))
				.finally(() => setLoading(false));
	}, [host, initiallyOpen]);
	const load = () => {
		setLoading(true);
		void host
			.detectBrowsers()
			.then(setSources)
			.catch((error) => setDetails(String(error)))
			.finally(() => setLoading(false));
	};
	const run = async (work: () => Promise<CookieImportResult>) => {
		if (busy) return;
		setBusy(true);
		const id = toast.loading(t('browser.cookie.reading'));
		try {
			const result = await work();
			const profile = host.profiles.getState().profiles.find((p) => p.id === profileId);
			const detail = [
				result.skipped ? t('browser.cookie.skipped', { count: result.skipped }) : '',
				result.googleSkipped ? t('browser.cookie.googleSkipped', { count: result.googleSkipped }) : '',
				result.decryptFailed
					? t('browser.cookie.decryptFailed', {
							count: result.decryptFailed,
							reason: t(`browser.cookie.reason.${result.warning ?? 'unknown'}`),
						})
					: '',
			]
				.filter(Boolean)
				.join('\n');
			toast[result.imported ? 'success' : 'warning'](
				t('browser.cookie.result', {
					count: result.imported,
					source: result.source,
					name: profile?.label || t('browser.profile.default'),
				}),
				{ id, description: detail, duration: 10000 },
			);
			if (result.imported)
				toast.info(t('browser.cookie.updated'), {
					action: {
						label: t('browser.cookie.reloadAll'),
						onClick: () => {
							for (const p of host.workspace.list())
								if (p.profileId === profileId) void host.getPage(p.id)?.reload();
						},
					},
				});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(t('browser.browser_failed'), {
				id,
				action: { label: t('browser.cookie.details'), onClick: () => setDetails(message) },
			});
		} finally {
			setBusy(false);
		}
	};
	const fromFile = () => {
		void host
			.chooseCookieFile()
			.then((path) => {
				if (path) void run(() => host.importCookiesFromFile(path, profileId));
			})
			.catch((error) => setDetails(String(error)));
	};
	return (
		<>
			<DropdownMenu
				modal={false}
				defaultOpen={initiallyOpen}
				onOpenChange={(open) => {
					if (open) load();
				}}
			>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						disabled={busy}
						className="h-7 shrink-0 gap-1 px-1"
						aria-label={t('browser.cookie.import')}
					>
						<Import className="size-4" />
						{!compact && t('browser.cookie.import')}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-72" align="end">
					<DropdownMenuLabel className="whitespace-normal text-xs font-normal text-muted-foreground">
						{t('browser.cookie.machine')}
					</DropdownMenuLabel>
					{loading && <DropdownMenuItem disabled>{t('browser.loading')}</DropdownMenuItem>}
					{!loading && !sources.length && (
						<DropdownMenuItem disabled>{t('browser.cookie.none')}</DropdownMenuItem>
					)}
					{sources.map((source) =>
						source.profiles.length === 1 ? (
							<DropdownMenuItem
								key={source.family}
								onSelect={() => {
									void run(() => host.importCookiesFromBrowser({ family: source.family }, profileId));
								}}
							>
								{source.label}
							</DropdownMenuItem>
						) : (
							<DropdownMenuSub key={source.family}>
								<DropdownMenuSubTrigger>{source.label}</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									{source.profiles.map((profile) => (
										<DropdownMenuItem
											key={profile.directory}
											onSelect={() => {
												void run(() =>
													host.importCookiesFromBrowser(
														{ family: source.family, profileDir: profile.directory },
														profileId,
													),
												);
											}}
										>
											{profile.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						),
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={fromFile}>{t('browser.cookie.file')}</DropdownMenuItem>
					<DropdownMenuLabel className="whitespace-normal text-xs font-normal text-muted-foreground">
						{t('browser.cookie.google')}
					</DropdownMenuLabel>
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog
				open={!!details}
				onOpenChange={(open) => {
					if (!open) setDetails('');
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('browser.cookie.details')}</DialogTitle>
						<DialogDescription>{t('browser.cookie.google')}</DialogDescription>
					</DialogHeader>
					<pre className="whitespace-pre-wrap break-all text-xs">{details}</pre>
				</DialogContent>
			</Dialog>
		</>
	);
}
