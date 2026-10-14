// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/BrowserNewProfileDialog.tsx
import { useState } from 'react';
import { toast } from 'sonner';
import type { BrowserEngine } from '../services/host';
import { useT } from '../../../ui/react/hooks';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Checkbox } from '../../../ui/components/checkbox';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '../../../ui/components/dialog';
import { CookieImport } from './cookies/CookieImport';
export function NewProfileDialog({
	host,
	open,
	onOpenChange,
}: {
	host: BrowserEngine;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useT(),
		[name, setName] = useState(''),
		[importAfter, setImportAfter] = useState(false),
		[created, setCreated] = useState(''),
		[busy, setBusy] = useState(false),
		[error, setError] = useState('');
	const create = async () => {
		setBusy(true);
		setError('');
		try {
			const profile = await host.createProfile(name);
			toast.success(t('browser.profile.created', { name: profile.label }));
			setName('');
			if (importAfter) setCreated(profile.id);
			else onOpenChange(false);
		} catch (error) {
			setError(String(error));
		} finally {
			setBusy(false);
		}
	};
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (!busy) {
					onOpenChange(value);
					if (!value) setCreated('');
				}
			}}
		>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t('browser.profile.add')}</DialogTitle>
					<DialogDescription>{t('browser.profile.description')}</DialogDescription>
				</DialogHeader>
				{created ? (
					<CookieImport host={host} profileId={created} initiallyOpen />
				) : (
					<>
						<Input
							autoFocus
							value={name}
							maxLength={40}
							aria-label={t('browser.profile.label')}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.nativeEvent.isComposing && name.trim()) void create();
							}}
						/>
						<label className="flex items-center gap-2 text-sm">
							<Checkbox
								checked={importAfter}
								onCheckedChange={(checked) => setImportAfter(checked === true)}
							/>
							{t('browser.profile.importAfter')}
						</label>
					</>
				)}
				{error && (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t('browser.cancel')}
					</Button>
					{!created && (
						<Button
							disabled={!name.trim() || busy}
							onClick={() => {
								void create();
							}}
						>
							{t('browser.profile.add')}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
