// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/browser-pane/browser-client-page-retained-elements.ts, browser-client-page-position-driver.ts
interface Driver {
	root: HTMLDivElement;
	hosts: number;
	syncs: Set<() => void>;
	frame?: number;
}
const drivers = new WeakMap<Document, Driver>();
function driver(doc: Document): Driver {
	let entry = drivers.get(doc);
	if (entry) return entry;
	const root = doc.body.createDiv({ cls: 'nand-ui nand-browser-retained-root' });
	root.dataset.nandBrowserRetainedRoot = '';
	entry = { root, hosts: 0, syncs: new Set() };
	drivers.set(doc, entry);
	return entry;
}
/** A retained webview's parent never changes within a Document. */
export class RetainedPage {
	readonly element: HTMLDivElement;
	private readonly driver: Driver;
	private placeholder?: HTMLElement;
	private resize?: ResizeObserver;
	private disposed = false;
	constructor(
		readonly doc: Document,
		id: string,
	) {
		this.driver = driver(doc);
		this.driver.hosts++;
		this.element = this.driver.root.createDiv({ cls: 'nand-browser-retained-host' });
		this.element.dataset.browserPageId = id;
		this.hide();
	}
	private sync = () => {
		const p = this.placeholder;
		if (
			!p?.isConnected ||
			p.ownerDocument !== this.doc ||
			p.closest('[hidden], [inert]') ||
			!p.getClientRects().length
		) {
			this.hide();
			return;
		}
		const r = p.getBoundingClientRect();
		this.element.inert = false;
		this.element.removeAttribute('aria-hidden');
		this.element.style.setProperty('--browser-left', `${r.left}px`);
		this.element.style.top = `${r.top}px`;
		this.element.style.width = `${r.width}px`;
		this.element.style.height = `${r.height}px`;
		this.element.classList.add('is-visible');
	};
	private hide() {
		this.element.inert = true;
		this.element.setAttribute('aria-hidden', 'true');
		this.element.classList.remove('is-visible');
	}
	mount(placeholder: HTMLElement) {
		if (this.disposed) return;
		if (placeholder.ownerDocument !== this.doc) throw new Error('A browser guest cannot move between Documents');
		if (this.placeholder === placeholder) {
			this.sync();
			return;
		}
		this.unmount();
		this.placeholder = placeholder;
		const win = this.doc.defaultView!;
		this.resize = new win.ResizeObserver(this.sync);
		this.resize.observe(placeholder);
		win.addEventListener('resize', this.sync);
		win.addEventListener('scroll', this.sync, true);
		this.driver.syncs.add(this.sync);
		this.sync();
		const frame = () => {
			this.driver.frame = undefined;
			for (const sync of [...this.driver.syncs])
				try {
					sync();
				} catch (error) {
					console.error('[NAND browser position]', error);
				}
			if (this.driver.syncs.size) this.driver.frame = win.requestAnimationFrame(frame);
		};
		if (this.driver.frame === undefined) this.driver.frame = win.requestAnimationFrame(frame);
	}
	unmount() {
		this.placeholder = undefined;
		this.resize?.disconnect();
		this.resize = undefined;
		const win = this.doc.defaultView!;
		win.removeEventListener('resize', this.sync);
		win.removeEventListener('scroll', this.sync, true);
		this.driver.syncs.delete(this.sync);
		if (!this.driver.syncs.size && this.driver.frame !== undefined) {
			win.cancelAnimationFrame(this.driver.frame);
			this.driver.frame = undefined;
		}
		this.hide();
	}
	dispose() {
		if (this.disposed) return;
		this.unmount();
		this.disposed = true;
		this.element.remove();
		if (--this.driver.hosts === 0) {
			this.driver.root.remove();
			drivers.delete(this.doc);
		}
	}
}
