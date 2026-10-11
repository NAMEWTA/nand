import { Component, type ComponentChildren } from 'preact';

/** Isolate a contributed component's render/update failure from adjacent components. */
export class RenderBoundary extends Component<{ children: ComponentChildren; onError: (error: unknown) => void }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
	componentDidCatch(error: unknown): void { this.props.onError(error); }
	render(): ComponentChildren { return this.state.failed ? null : this.props.children; }
}
