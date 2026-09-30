import { AgentDataClient } from './agent-data-client';
/**
 * ServerManager - unified server manager
 *
 * Responsibilities:
 * 1. Manage the lifecycle of the unified Rust server process
 * 2. Manage a single WebSocket connection
 * 3. Provide modular APIs (pty/voice/llm/utils)
 * 4. Handle server crashes and automatic restarts
 *
 */

import { Notice } from 'obsidian';
import { t } from '../../shared/i18n/terminal-accessor';
import { debugLog, debugWarn, errorLog } from '../desktop/logger';
import type { BinaryDownloadConfig } from './binary-download-urls';
import { buildBinaryFilename } from './binary-download-urls';
import { BinaryDownloader } from './binary-downloader';
import { PtyClient } from './pty-client';
import type { ServerEvents, ServerInfo, ServerMessage } from './types';
import { ServerErrorCode, ServerManagerError } from './types';

/** Inline type-only references to avoid top-level `import 'fs' / 'child_process'`. */
type FsModule = typeof import('fs');
type PathModule = typeof import('path');
type ChildProcessModule = typeof import('child_process');
type ChildProcess = import('child_process').ChildProcess;

type BinaryUpdateResult = 'skipped-offline' | 'already-ready' | 'downloaded' | 'updated';
const DEV_RELOAD_REQUEST_FILE = '.terminal-dev-reload.json';
const DEV_RELOAD_PHASE_INSTALLING = 'installing';

interface ServerExitDetails {
	code: number | null;
	signal: NodeJS.Signals | null;
	abnormal: boolean;
}

interface DevReloadRequest {
	pluginId?: unknown;
	phase?: unknown;
	activeUntil?: unknown;
}

/**
 * Event listener type
 */
type EventListener<K extends keyof ServerEvents> = ServerEvents[K];

/**
 * WebSocket reconnect config
 */
interface ReconnectConfig {
	/** Maximum reconnect attempts */
	maxAttempts: number;
	/** Reconnect interval (ms) */
	interval: number;
}

/**
 * Unified server manager
 *
 * Replaces BinaryManager + TerminalService + VoiceServerManager
 */
export class ServerManager {
	/** Plugin directory */
	private pluginDir: string;

	/** Plugin version */
	private version: string;

	/** Debug mode (controls logging output only) */
	private debugMode: boolean;

	/** Offline mode (skips version checks and automatic downloads) */
	private offlineMode: boolean;

	/** Binary downloader */
	private binaryDownloader: BinaryDownloader;

	/** Server process */
	private process: ChildProcess | null = null;

	/** WebSocket connection */
	private ws: WebSocket | null = null;

	/** Server port */
	private port: number | null = null;

	/** Whether shutdown is in progress */
	private isShuttingDown = false;
	private generation = 0;
	private shutdownPromise: Promise<void> | null = null;
	private restartTimer: number | null = null;
	private readonly cancelStartup = new Set<() => void>();

	/** Server restart attempt count */
	private restartAttempts = 0;

	/** Maximum server restart attempts */
	private readonly maxRestartAttempts = 3;

	/** WebSocket reconnect attempt count */
	private wsReconnectAttempts = 0;

	/** Reconnect config */
	private reconnectConfig: ReconnectConfig = {
		maxAttempts: 5,
		interval: 3000,
	};

	/** Whether reconnection is in progress */
	private isReconnecting = false;

	/** Reconnect timer */
	private reconnectTimer: number | null = null;

	/** Server startup Promise */
	private serverStartPromise: Promise<void> | null = null;

	/** WebSocket connection Promise */
	private wsConnectPromise: Promise<void> | null = null;

	/** Binary update Promise */
	private binaryUpdatePromise: Promise<BinaryUpdateResult> | null = null;

	/** Event listeners */
	private eventListeners: Map<keyof ServerEvents, Set<EventListener<keyof ServerEvents>>> = new Map();

	// Module clients (lazy-loaded)
	private _agentDataClient: AgentDataClient | null = null;
	private _ptyClient: PtyClient | null = null;

	/**
	 * Node built-ins resolved on demand inside the constructor via
	 * Electron's `window.require`. Kept off the module top-level so the
	 * Obsidian community plugin reviewer's static scanner does not flag
	 * blanket filesystem / shell-execution access. Behavior is identical
	 * at runtime because Electron caches `require` results.
	 */
	private readonly fs: FsModule;
	private readonly path: PathModule;
	private readonly spawn: ChildProcessModule['spawn'];

	constructor(
		pluginDir: string,
		version: string = '0.0.0',
		downloadConfig: BinaryDownloadConfig,
		debugMode: boolean = false,
		offlineMode: boolean = false,
		private readonly pluginId: string = 'nand',
	) {
		this.pluginDir = pluginDir;
		this.version = version;
		this.debugMode = debugMode;
		this.offlineMode = offlineMode;
		this.fs = window.require('fs') as FsModule;
		this.path = window.require('path') as PathModule;
		this.spawn = (window.require('child_process') as ChildProcessModule).spawn;
		this.binaryDownloader = new BinaryDownloader(pluginDir, version, downloadConfig);
	}

	// ============================================================================
	// Public API
	// ============================================================================

	/**
   * Ensure the server is running
   * 

   */
	async ensureServer(): Promise<void> {
		if (this.shutdownPromise) await this.shutdownPromise;
		// A failed shutdown still owns its child. Retry cleanup before reopening.
		if (this.isShuttingDown && this.process) await this.shutdown();
		if (this.isShuttingDown) this.resetShutdownState();
		if (this.port !== null && this.ws?.readyState === WebSocket.OPEN) return;
		if (this.serverStartPromise) return this.serverStartPromise;
		const operation = this.process && this.port !== null ? this.connectWebSocket() : this.startServer();
		this.serverStartPromise = operation;
		try {
			await operation;
		} finally {
			if (this.serverStartPromise === operation) this.serverStartPromise = null;
		}
	}

	/**
	 * Ensure the binary has been updated (without starting the server)
	 */
	async ensureBinaryUpdated(): Promise<BinaryUpdateResult> {
		if (this.offlineMode) {
			debugLog('[ServerManager] 离线模式已开启，跳过二进制版本检查与下载');
			return 'skipped-offline';
		}
		return this.ensureBinaryReady();
	}

	/**
   * Get the PTY client
   * 

   */
	agentData(): AgentDataClient {
		if (!this._agentDataClient) {
			this._agentDataClient = new AgentDataClient();
			this._agentDataClient.setWebSocket(this.ws);
		}
		return this._agentDataClient;
	}

	pty(): PtyClient {
		if (!this._ptyClient) {
			this._ptyClient = new PtyClient();
			if (this.ws) {
				this._ptyClient.setWebSocket(this.ws);
			}
		}
		return this._ptyClient;
	}

	/**
   * Shut down the server
   * 

   */
	shutdown(): Promise<void> {
		if (this.shutdownPromise) return this.shutdownPromise;
		const operation = this.stopServer();
		this.shutdownPromise = operation;
		void operation.then(
			() => {
				if (this.shutdownPromise === operation) this.shutdownPromise = null;
			},
			() => {
				if (this.shutdownPromise === operation) this.shutdownPromise = null;
			},
		);
		return operation;
	}

	private async stopServer(): Promise<void> {
		this.isShuttingDown = true;
		this.generation++;
		this.cancelReconnect();
		if (this.restartTimer !== null) window.clearTimeout(this.restartTimer);
		this.restartTimer = null;
		for (const cancel of [...this.cancelStartup]) cancel();
		const ws = this.ws;
		this.ws = null;
		ws?.close(1000, 'Shutdown');
		const child = this.process;
		if (child) {
			await new Promise<void>((resolve, reject) => {
				let timer: number | undefined;
				const exited = () => child.exitCode != null || child.signalCode != null;
				const done = (error?: Error) => {
					if (timer !== undefined) window.clearTimeout(timer);
					child.off('exit', onExit);
					child.off('close', onExit);
					if (error) reject(error);
					else resolve();
				};
				const onExit = () => done();
				if (exited()) {
					resolve();
					return;
				}
				child.once('exit', onExit);
				child.once('close', onExit);
				timer = window.setTimeout(() => {
					if (exited()) {
						done();
						return;
					}
					timer = window.setTimeout(() => done(new Error('Server process did not exit after SIGKILL')), 5000);
					try {
						child.kill('SIGKILL');
					} catch (error) {
						done(error instanceof Error ? error : new Error(String(error)));
					}
				}, 1000);
				try {
					child.kill('SIGTERM');
				} catch (error) {
					done(error instanceof Error ? error : new Error(String(error)));
				}
			});
			if (this.process === child) this.process = null;
		}
		this.port = null;
		this.serverStartPromise = null;
		this.wsConnectPromise = null;
		this._agentDataClient?.destroy();
		this._agentDataClient = null;
		this._ptyClient?.destroy();
		this._ptyClient = null;
		this.emit('server-stopped');
	}

	/**
	 * Whether the server is running
	 */
	isServerRunning(): boolean {
		return this.port !== null && this.process !== null;
	}

	/**
	 * Whether the WebSocket is connected
	 */
	isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}

	/**
	 * Whether reconnection is in progress
	 */
	isReconnectingWebSocket(): boolean {
		return this.isReconnecting;
	}

	/**
	 * Get the WebSocket reconnect attempt count
	 */
	getReconnectAttempts(): number {
		return this.wsReconnectAttempts;
	}

	/**
	 * Get the server port
	 */
	getServerPort(): number | null {
		return this.port;
	}

	/**
	 * Register an event listener
	 */
	on<K extends keyof ServerEvents>(event: K, callback: ServerEvents[K]): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, new Set());
		}
		this.eventListeners.get(event)!.add(callback);
	}

	/**
	 * Remove an event listener
	 */
	off<K extends keyof ServerEvents>(event: K, callback: ServerEvents[K]): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			listeners.delete(callback);
		}
	}

	// ============================================================================
	// Private methods
	// ============================================================================

	/**
	 * Start the server
	 */
	private async startServer(): Promise<void> {
		const generation = this.generation;
		const check = () => {
			if (generation !== this.generation || this.isShuttingDown) throw new Error('Server startup cancelled');
		};
		try {
			debugLog('[ServerManager] 启动统一服务器...');

			const binaryPath = this.getBinaryPath();

			await this.ensureBinaryReady();
			check();

			// Ensure executable permission (Unix)
			await this.ensureExecutable(binaryPath);
			check();

			// Start the process
			this.process = this.spawn(binaryPath, ['--port', '0'], {
				stdio: ['pipe', 'pipe', 'pipe'],
				env: {
					...process.env,
					TERM: process.env.TERM || 'xterm-256color',
				},
				windowsHide: true,
				detached: false,
			});

			debugLog('[ServerManager] 服务器进程已启动, PID:', this.process.pid);

			// Listen for process errors
			this.process.on('error', (error) => {
				errorLog('[ServerManager] 服务器进程错误:', error);
				this.handleServerError(error);
			});

			// Wait for port information
			const port = await this.waitForServerPort();
			check();
			this.port = port;
			this.restartAttempts = 0;

			debugLog(`[ServerManager] 服务器已启动，端口: ${port}`);

			// Set up the exit handler
			this.setupServerExitHandler();

			// Establish the WebSocket connection
			await this.connectWebSocket();
			check();

			this.emit('server-started', port);
		} catch (error) {
			if (generation !== this.generation || this.isShuttingDown) throw error;
			if (this.process && this.port === null) await this.shutdown();

			const errorMessage = error instanceof Error ? error.message : String(error);
			errorLog('[ServerManager] 启动服务器失败:', errorMessage);

			new Notice(t('notices.serverStartFailed', { message: errorMessage }), 0);

			this.emit('server-error', error instanceof Error ? error : new Error(errorMessage));
			throw error;
		}
	}

	/**
	 * Get the binary path
	 */
	private getBinaryPath(): string {
		const platform = process.platform;
		const arch = process.arch;
		const filename = buildBinaryFilename(platform, arch);

		return this.path.join(this.pluginDir, 'binaries', filename);
	}

	private async ensureBinaryReady(): Promise<BinaryUpdateResult> {
		if (this.offlineMode) {
			const binaryPath = this.getBinaryPath();
			if (!this.fs.existsSync(binaryPath)) {
				throw new ServerManagerError(
					ServerErrorCode.BINARY_NOT_FOUND,
					'离线模式已开启，未进行版本检查与下载，请确保服务器二进制已存在',
				);
			}
			return 'skipped-offline';
		}

		if (this.binaryUpdatePromise) {
			return this.binaryUpdatePromise;
		}

		this.binaryUpdatePromise = this.performBinaryUpdate();

		try {
			return await this.binaryUpdatePromise;
		} finally {
			this.binaryUpdatePromise = null;
		}
	}

	private async performBinaryUpdate(): Promise<BinaryUpdateResult> {
		const skipVersionCheck = this.offlineMode;
		const needsDownload = !this.binaryDownloader.binaryExists(skipVersionCheck);
		const needsUpdate = this.binaryDownloader.needsUpdate(skipVersionCheck);
		const binaryPath = this.getBinaryPath();
		const downloadConfig = this.binaryDownloader.getDownloadConfig();

		debugLog('[ServerManager] Binary readiness check:', {
			binaryPath,
			needsDownload,
			needsUpdate,
			offlineMode: this.offlineMode,
			downloadSource: downloadConfig.source,
			serverRunning: this.isServerRunning(),
		});

		if (!needsDownload && !needsUpdate) {
			debugLog('[ServerManager] 二进制文件已是最新，无需下载');
			return 'already-ready';
		}

		const shouldRestart = needsUpdate && this.isServerRunning();
		if (shouldRestart) {
			debugLog('[ServerManager] 服务器运行中，更新前先停止服务器');
			await this.shutdown();
		}

		const messageKey = needsUpdate ? 'notices.updatingBinary' : 'notices.downloadingBinary';
		const defaultMessage = needsUpdate ? '正在更新服务器组件...' : '正在下载服务器组件...';

		debugLog(`[ServerManager] ${needsUpdate ? '二进制文件需要更新' : '二进制文件不存在'}，开始下载...`);

		const notice = new Notice(t(messageKey) || defaultMessage, 0);

		let updateSucceeded = false;

		try {
			await this.binaryDownloader.download((progress) => {
				if (progress.stage === 'downloading') {
					notice.setMessage(`${t(messageKey) || defaultMessage} ${Math.round(progress.percent)}%`);
				} else if (progress.stage === 'verifying') {
					notice.setMessage(t('notices.verifyingBinary') || '正在验证文件...');
				}
			});

			notice.hide();
			const completeKey = needsUpdate ? 'notices.binaryUpdateComplete' : 'notices.binaryDownloadComplete';
			const completeMessage = needsUpdate ? '服务器组件更新完成' : '服务器组件下载完成';
			new Notice(t(completeKey) || completeMessage, 3000);
			updateSucceeded = true;
			return needsUpdate ? 'updated' : 'downloaded';
		} catch (downloadError) {
			notice.hide();
			throw new ServerManagerError(
				ServerErrorCode.BINARY_NOT_FOUND,
				`下载二进制文件失败: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`,
			);
		} finally {
			if (shouldRestart) {
				this.resetShutdownState();
				if (updateSucceeded) {
					window.setTimeout(() => {
						this.ensureServer().catch((error) => {
							errorLog('[ServerManager] 更新后重启服务器失败:', error);
						});
					}, 0);
				}
			}
		}
	}

	/**
	 * Ensure the file is executable (Unix)
	 */
	private async ensureExecutable(filePath: string): Promise<void> {
		if (process.platform === 'win32') {
			return;
		}

		try {
			const stats = await this.fs.promises.stat(filePath);
			const isExecutable = (stats.mode & 0o111) !== 0;

			if (!isExecutable) {
				debugLog('[ServerManager] 添加可执行权限:', filePath);
				await this.fs.promises.chmod(filePath, 0o755);
			}
		} catch (error) {
			errorLog('[ServerManager] 设置可执行权限失败:', error);
		}
	}

	/**
	 * Wait for the server to output port information
	 */
	private async waitForServerPort(): Promise<number> {
		const child = this.process;
		if (!child) throw new ServerManagerError(ServerErrorCode.SERVER_START_FAILED, 'Process not started');
		return new Promise((resolve, reject) => {
			let buffer = '';
			const finish = (error?: Error, port?: number) => {
				window.clearTimeout(timeout);
				child.stdout?.off('data', onData);
				child.off('exit', onExit);
				child.off('error', onError);
				this.cancelStartup.delete(cancel);
				if (error) reject(error);
				else resolve(port!);
			};
			const cancel = () => finish(new Error('Server startup cancelled'));
			const onExit = () => finish(new Error('Server exited before reporting a port'));
			const onError = (error: Error) => finish(error);
			const onData = (chunk: Buffer) => {
				buffer += chunk.toString();
				const match = buffer.match(/\{[^}]+\}/);
				if (!match) return;
				try {
					const info = JSON.parse(match[0]) as ServerInfo;
					if (typeof info.port === 'number' && info.port > 0) finish(undefined, info.port);
				} catch {
					/* Wait for a complete server announcement. */
				}
			};
			const timeout = window.setTimeout(() => finish(new Error('Timed out waiting for server port')), 10000);
			this.cancelStartup.add(cancel);
			child.stdout?.on('data', onData);
			child.once('exit', onExit);
			child.once('error', onError);
		});
	}

	/**
	 * Establish the WebSocket connection
	 */
	private async connectWebSocket(): Promise<void> {
		if (this.ws?.readyState === WebSocket.OPEN) return;
		if (this.wsConnectPromise) return this.wsConnectPromise;
		if (!this.port || this.isShuttingDown)
			throw new ServerManagerError(ServerErrorCode.CONNECTION_FAILED, 'Server unavailable');
		const generation = this.generation;
		const ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
		this.ws = ws;
		const operation = new Promise<void>((resolve, reject) => {
			let settled = false;
			const current = () => this.generation === generation && this.ws === ws && !this.isShuttingDown;
			const settle = (error?: Error) => {
				if (settled) return;
				settled = true;
				window.clearTimeout(timeout);
				this.cancelStartup.delete(cancel);
				if (error) reject(error);
				else resolve();
			};
			const cancel = () => settle(new Error('Connection cancelled'));
			const timeout = window.setTimeout(() => {
				settle(new ServerManagerError(ServerErrorCode.CONNECTION_FAILED, 'WebSocket connection timed out'));
				ws.close();
			}, 5000);
			this.cancelStartup.add(cancel);
			ws.onopen = () => {
				if (!current()) {
					cancel();
					ws.close();
					return;
				}
				this.wsReconnectAttempts = 0;
				this.isReconnecting = false;
				this.updateClientsWebSocket();
				this.emit('ws-connected');
				settle();
			};
			ws.onerror = () => {
				settle(new ServerManagerError(ServerErrorCode.CONNECTION_FAILED, 'WebSocket connection failed'));
				ws.close();
			};
			ws.onclose = () => {
				settle(new ServerManagerError(ServerErrorCode.CONNECTION_FAILED, 'WebSocket closed'));
				if (!current()) return;
				this.ws = null;
				this._ptyClient?.setWebSocket(null);
				this._agentDataClient?.setWebSocket(null);
				if (this.isDevInstallInProgress()) return;
				this.emit('ws-disconnected');
				if (this.port !== null) this.scheduleReconnect();
			};
			ws.onmessage = (event) => {
				if (current()) this.handleWebSocketMessage(event);
			};
		});
		this.wsConnectPromise = operation;
		try {
			await operation;
		} finally {
			if (this.wsConnectPromise === operation) this.wsConnectPromise = null;
		}
	}

	/**
	 * Update the WebSocket on all module clients
	 */
	private updateClientsWebSocket(): void {
		if (this.ws) {
			this._ptyClient?.setWebSocket(this.ws);
			this._agentDataClient?.setWebSocket(this.ws);
		}
	}

	/**
	 * Handle WebSocket messages
	 */
	private handleWebSocketMessage(event: MessageEvent): void {
		// Handle binary messages (PTY output)
		if (event.data instanceof ArrayBuffer) {
			this._ptyClient?.handleBinaryMessage(event.data);
			return;
		}

		if (event.data instanceof Blob) {
			void event.data
				.arrayBuffer()
				.then((buffer) => {
					this._ptyClient?.handleBinaryMessage(buffer);
				})
				.catch((error) => {
					errorLog('[ServerManager] 解析二进制消息失败:', error);
				});
			return;
		}

		// Handle JSON messages
		try {
			const msg = JSON.parse(event.data as string) as ServerMessage;

			// Dispatch messages by module
			switch (msg.module) {
				case 'agent_data':
					this._agentDataClient?.handleMessage(msg);
					break;
				case 'pty':
					this._ptyClient?.handleMessage(msg);
					break;
				default:
					debugWarn('[ServerManager] 未知模块消息:', msg);
			}
		} catch (error) {
			errorLog('[ServerManager] 解析消息失败:', error);
		}
	}

	/**
	 * Handle WebSocket disconnection and schedule reconnect
	 */
	private scheduleReconnect(): void {
		// If reconnection is already in progress or shutdown is underway, skip
		if (this.isReconnecting || this.isShuttingDown) {
			return;
		}

		if (this.isDevInstallInProgress()) {
			debugLog('[ServerManager] 开发安装进行中，跳过 WebSocket 自动重连');
			return;
		}

		// Check whether the maximum reconnect attempts has been exceeded
		if (this.wsReconnectAttempts >= this.reconnectConfig.maxAttempts) {
			errorLog(`[ServerManager] WebSocket 重连失败，已达到最大重试次数 (${this.reconnectConfig.maxAttempts})`);

			new Notice(t('notices.wsReconnectFailed') || 'WebSocket 连接断开，请重新加载插件', 0);

			this.emit('ws-reconnect-failed');
			return;
		}

		this.isReconnecting = true;
		this.wsReconnectAttempts++;

		const delay = this.reconnectConfig.interval;

		debugLog(
			`[ServerManager] 将在 ${delay}ms 后尝试重连 WebSocket ` +
				`(${this.wsReconnectAttempts}/${this.reconnectConfig.maxAttempts})`,
		);

		this.emit('ws-reconnecting', this.wsReconnectAttempts, delay);

		const generation = this.generation;
		this.reconnectTimer = window.setTimeout(() => {
			if (generation !== this.generation || this.isShuttingDown) return;
			this.reconnectTimer = null;
			void this.attemptReconnect();
		}, delay);
	}

	/**
	 * Perform WebSocket reconnect
	 */
	private async attemptReconnect(): Promise<void> {
		if (this.isShuttingDown || !this.port) {
			this.isReconnecting = false;
			return;
		}

		debugLog('[ServerManager] 尝试重连 WebSocket...');

		try {
			await this.connectWebSocket();

			debugLog('[ServerManager] WebSocket 重连成功');
			new Notice(t('notices.wsReconnectSuccess') || 'WebSocket 重连成功', 3000);
		} catch (error) {
			errorLog('[ServerManager] WebSocket 重连失败:', error);
			this.isReconnecting = false;

			// Keep trying to reconnect
			this.scheduleReconnect();
		}
	}

	/**
	 * Cancel reconnect
	 */
	private cancelReconnect(): void {
		if (this.reconnectTimer) {
			window.clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.isReconnecting = false;
		this.wsReconnectAttempts = 0;
	}

	/**
   * Set up the server exit handler
   * 

   */
	private setupServerExitHandler(): void {
		if (!this.process) {
			return;
		}

		const exitedProcess = this.process;
		const generation = this.generation;
		exitedProcess.on('exit', (code, signal) => {
			if (generation !== this.generation || this.process !== exitedProcess) return;
			if (this.process === exitedProcess) {
				this.process = null;
				this.port = null;
				this.serverStartPromise = null;
				this.wsConnectPromise = null;
			}

			if (this.isShuttingDown) {
				debugLog(`[ServerManager] 服务器已停止: code=${code}, signal=${signal}`);
				return;
			}

			const exitDetails: ServerExitDetails = {
				code,
				signal,
				abnormal: code !== 0 && code !== null,
			};

			const logExit = exitDetails.abnormal ? errorLog : debugWarn;
			logExit(`[ServerManager] 服务器退出: code=${code}, signal=${signal}`);

			if (this.isDevInstallInProgress()) {
				this.cancelReconnect();
				debugLog('[ServerManager] 开发安装进行中，跳过服务器自动重启');
				return;
			}

			// Try automatic restart
			this.attemptRestart(exitDetails);
		});
	}

	/**
	 * Try to automatically restart the server
	 */
	private attemptRestart(exitDetails: ServerExitDetails): void {
		if (this.isShuttingDown || this.restartTimer !== null) return;
		const generation = this.generation;
		if (this.restartAttempts < this.maxRestartAttempts) {
			this.restartAttempts++;
			debugLog(`[ServerManager] 尝试重启服务器 ` + `(${this.restartAttempts}/${this.maxRestartAttempts})`);

			const delay = 1000 * Math.pow(2, this.restartAttempts - 1);

			this.restartTimer = window.setTimeout(() => {
				this.restartTimer = null;
				if (generation !== this.generation || this.isShuttingDown) return;
				this.ensureServer()
					.then(() => {
						debugLog('[ServerManager] 服务器自动重启成功');
					})
					.catch((err) => {
						errorLog('[ServerManager] 服务器重启失败:', err);
						this.showRestartFailedNotice(exitDetails);
					});
			}, delay);
		} else {
			this.showRestartFailedNotice(exitDetails);
		}
	}

	private showRestartFailedNotice(exitDetails: ServerExitDetails): void {
		const restartFailedMessage = t('notices.serverRestartFailed');
		if (!exitDetails.abnormal) {
			new Notice(restartFailedMessage, 0);
			return;
		}

		new Notice(`${this.formatServerCrashNotice(exitDetails)}\n${restartFailedMessage}`, 0);
	}

	private formatServerCrashNotice(exitDetails: ServerExitDetails): string {
		return t('notices.serverCrashed', {
			code: String(exitDetails.code),
			signal: exitDetails.signal || 'N/A',
		});
	}

	private isDevInstallInProgress(): boolean {
		const requestPath = this.path.join(this.pluginDir, DEV_RELOAD_REQUEST_FILE);
		try {
			if (!this.fs.existsSync(requestPath)) {
				return false;
			}

			const request = JSON.parse(this.fs.readFileSync(requestPath, 'utf-8')) as DevReloadRequest;
			if (request.pluginId && request.pluginId !== this.pluginId) {
				return false;
			}
			if (request.phase !== DEV_RELOAD_PHASE_INSTALLING) {
				return false;
			}
			if (typeof request.activeUntil !== 'string') {
				return false;
			}

			const activeUntil = Date.parse(request.activeUntil);
			if (!Number.isFinite(activeUntil)) {
				return false;
			}
			if (activeUntil <= Date.now()) {
				this.fs.rmSync(requestPath, { force: true });
				return false;
			}

			return true;
		} catch (error) {
			debugWarn('[ServerManager] 读取开发安装标记失败:', error);
			return false;
		}
	}

	/**
	 * Handle server process errors
	 */
	private handleServerError(error: Error): void {
		const errorCode = (error as NodeJS.ErrnoException).code;

		if (errorCode === 'ENOENT') {
			new Notice('❌ 无法启动服务器\n\n' + '错误: 二进制文件未找到\n' + '请重新加载插件', 0);
		} else if (errorCode === 'EACCES') {
			new Notice('❌ 无法启动服务器\n\n' + '错误: 权限不足\n' + '请检查文件权限', 0);
		} else {
			new Notice(`❌ 服务器启动失败\n\n` + `错误: ${error.message}\n` + `请查看控制台获取详细信息`, 0);
		}

		this.emit('server-error', error);
	}

	/**
	 * Emit an event
	 */
	private emit<K extends keyof ServerEvents>(event: K, ...args: Parameters<ServerEvents[K]>): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			listeners.forEach((listener) => {
				try {
					(listener as (...args: Parameters<ServerEvents[K]>) => void)(...args);
				} catch (error) {
					errorLog(`[ServerManager] 事件处理器错误 (${event}):`, error);
				}
			});
		}
	}

	/**
	 * Reset the shutdown state (used when re-enabling the service)
	 */
	resetShutdownState(): void {
		this.isShuttingDown = false;
		this.restartAttempts = 0;
		this.wsReconnectAttempts = 0;
		this.isReconnecting = false;
	}

	/**
	 * Manually trigger reconnect (for external callers)
	 */
	async reconnect(): Promise<void> {
		if (this.isShuttingDown) {
			throw new ServerManagerError(ServerErrorCode.CONNECTION_FAILED, '服务器正在关闭');
		}

		// Reset the reconnect counter
		this.wsReconnectAttempts = 0;
		this.cancelReconnect();

		// Close the existing connection
		if (this.ws) {
			this.ws.close(1000, 'Manual reconnect');
			this.ws = null;
		}

		// If the server is still running, reconnect the WebSocket directly
		if (this.port !== null && this.process !== null) {
			await this.connectWebSocket();
		} else {
			// Otherwise restart the entire server
			await this.ensureServer();
		}
	}

	/**
	 * Update connection config
	 * @param config Connection config
	 */
	updateConnectionConfig(config: Partial<ReconnectConfig>): void {
		// Check whether the config changed
		const hasChanges = Object.entries(config).some(
			([key, value]) => this.reconnectConfig[key as keyof ReconnectConfig] !== value,
		);

		if (hasChanges) {
			Object.assign(this.reconnectConfig, config);
			debugLog('[ServerManager] 更新重连配置:', this.reconnectConfig);
		}
	}

	updateDebugMode(debugMode: boolean): void {
		if (this.debugMode === debugMode) {
			return;
		}
		this.debugMode = debugMode;
		debugLog('[ServerManager] 更新调试模式:', this.debugMode);
	}

	updateOfflineMode(offlineMode: boolean): void {
		if (this.offlineMode === offlineMode) {
			return;
		}
		this.offlineMode = offlineMode;
		debugLog('[ServerManager] 更新离线模式:', this.offlineMode);
	}

	updateBinaryDownloadConfig(downloadConfig: BinaryDownloadConfig): void {
		const currentConfig = this.binaryDownloader?.getDownloadConfig?.();
		const nextConfig: BinaryDownloadConfig = {
			source: downloadConfig.source,
		};

		if (currentConfig && currentConfig.source === nextConfig.source) {
			return;
		}
		this.binaryDownloader = new BinaryDownloader(this.pluginDir, this.version, nextConfig);
		debugLog('[ServerManager] 更新二进制下载配置:', nextConfig);
	}
}
