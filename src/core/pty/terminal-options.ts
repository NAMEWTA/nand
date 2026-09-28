export interface TerminalOptions {
	shellType?: string;
	shellArgs?: string[];
	cwd?: string;
	env?: Record<string, string>;
	fontSize?: number;
	fontFamily?: string;
	cursorStyle?: 'block' | 'underline' | 'bar';
	cursorBlink?: boolean;
	scrollback?: number;
	preferredRenderer?: 'canvas' | 'webgl';
	useObsidianTheme?: boolean;
	backgroundColor?: string;
	foregroundColor?: string;
	backgroundImage?: string;
	backgroundImageOpacity?: number;
	backgroundImageSize?: 'cover' | 'contain' | 'auto';
	backgroundImagePosition?: string;
	enableBlur?: boolean;
	blurAmount?: number;
	textOpacity?: number;
}
