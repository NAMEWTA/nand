import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '../components/nand/EmptyState';
import { Button } from '../components/button';
import { useT } from './hooks';

function ErrorFallback({ retry }: { retry: () => void }) {
	const t = useT();
	return (
		<div role="alert">
			<EmptyState
				icon={<AlertTriangle />}
				title={t('ui.renderError')}
				description={t('ui.renderErrorDescription')}
				action={<Button onClick={retry}>{t('ui.retry')}</Button>}
			/>
		</div>
	);
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	override state = { failed: false };
	static getDerivedStateFromError(): { failed: boolean } {
		return { failed: true };
	}
	override componentDidCatch(error: Error, info: ErrorInfo): void {
		console.error('[NAND UI]', error, info.componentStack);
	}
	override render(): ReactNode {
		return this.state.failed ? (
			<ErrorFallback retry={() => this.setState({ failed: false })} />
		) : (
			this.props.children
		);
	}
}
