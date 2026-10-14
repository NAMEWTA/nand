import { fileURLToPath } from 'node:url';
import { guardedAdapter, patchText } from './ui-adapter-guard.mjs';

const contextPath = fileURLToPath(new URL('../src/ui/react/contexts.ts', import.meta.url));
const resourcePath = fileURLToPath(new URL('../src/ui/react/document-resource.ts', import.meta.url));
const ownerImport = `import { useOwnerDocument } from ${JSON.stringify(contextPath)};\n`;
const resourceImport = `import { documentResource } from ${JSON.stringify(resourcePath)};\n`;

/** Radix FocusScope still uses ambient document for autofocus and Tab wrapping.
 * Obsidian adopts React containers into popout documents without reloading the
 * plugin. Adapt those references to the scope/candidate's owner document while
 * retaining Radix's focus algorithm. Installed packages remain untouched.
 * Keep exact anchors so an upstream update cannot silently disable the fix.
 */
export function adaptFocusScope(source) {
	function replaceOnce(before, after) {
		if (source.split(before).length !== 2) throw new Error(`Radix FocusScope changed: ${before}`);
		source = source.replace(before, after);
	}
	replaceOnce(
		'const [container, setContainer] = React.useState(null);',
		`const [container, setContainer] = React.useState(null);
    const document = useOwnerDocument();
    const ownerWindow = document.defaultView ?? globalThis.window;
    const MutationObserver = ownerWindow.MutationObserver;
    const CustomEvent = ownerWindow.CustomEvent;
    const setTimeout = ownerWindow.setTimeout.bind(ownerWindow);
    const focusScopesStack = documentFocusScopes(document);`,
	);
	replaceOnce(
		'function focusFirst(candidates, { select = false } = {}) {',
		`function focusFirst(candidates, { select = false } = {}) {
  const document = candidates[0]?.ownerDocument ?? globalThis.document;`,
	);
	// The first render has no container. Refresh the keyboard callback when its
	// document changes after ref attachment, instead of retaining that fallback.
	replaceOnce('[loop, trapped, focusScope.paused]', '[loop, trapped, focusScope.paused, document]');
	replaceOnce(
		'function getTabbableCandidates(container) {',
		`function getTabbableCandidates(container) {
  const document = container.ownerDocument;`,
	);
	replaceOnce(
		'function focus(element, { select = false } = {}) {',
		`function focus(element, { select = false } = {}) {
  const document = element?.ownerDocument ?? globalThis.document;`,
	);
	replaceOnce(
		'function isHidden(node, { upTo }) {',
		`function isHidden(node, { upTo }) {
  const ownerWindow = node.ownerDocument.defaultView;
  const getComputedStyle = ownerWindow.getComputedStyle.bind(ownerWindow);`,
	);
	// Older transitive FocusScope releases still use an instanceof across realms.
	source = source.replace('element instanceof HTMLInputElement', 'element.tagName === "INPUT"');
	replaceOnce(
		'var focusScopesStack = createFocusScopesStack();',
		`function documentFocusScopes(document) {
  return documentResource(document, "focus-scopes", createFocusScopesStack);
}`,
	);
	return ownerImport + resourceImport + source;
}


function adaptFocusGuards(source) {
	return ownerImport + resourceImport + patchText(source, 'FocusGuards')
		.replace('var count = 0;\nvar guards = null;', '')
		.replace('function useFocusGuards() {', `function useFocusGuards() {
  const document = useOwnerDocument();
  const state = documentResource(document, "focus-guards", () => ({count: 0, guards: null}));`)
		.replace('if (!guards)', 'if (!state.guards)')
		.replace('guards = { start:', 'state.guards = { start:')
		.replace('const { start, end } = guards;', 'const { start, end } = state.guards;')
		.replace('guards?.', 'state.guards?.', 2)
		.replace('guards = null;', 'state.guards = null;')
		.replace('count++;', 'state.count++;')
		.replace('count === 1', 'state.count === 1')
		.replace('count = Math.max(0, count - 1);', 'state.count = Math.max(0, state.count - 1);')
		.replace('createFocusGuard()', 'createFocusGuard(document)', 3)
		.replace('}, []);', '}, [document, state]);')
		.source;
}

function adaptDismissableLayer(source) {
	return ownerImport + resourceImport + patchText(source, 'DismissableLayer')
		.replace('var originalBodyPointerEvents;\n', '')
		.replace('var DismissableLayerContext = React.createContext({', 'function documentLayers(document) { return documentResource(document, "dismissable-layers", () => ({')
		.replace('});\nvar DismissableLayer =', '})); }\nvar DismissableLayer =')
		.replace('React.useContext(DismissableLayerContext)', 'documentLayers(useOwnerDocument())', 3)
		.replace('const ownerDocument = node?.ownerDocument ?? globalThis?.document;', 'const ownerDocument = useOwnerDocument();\n    const Node = ownerDocument.defaultView.Node;')
		.replace('originalBodyPointerEvents', 'context.originalBodyPointerEvents', 2)
		.replace('dispatchUpdate();', 'dispatchUpdate(ownerDocument);', 2)
		.replace('[node, context]);', '[node, context, ownerDocument]);')
		.replace('document.addEventListener(CONTEXT_UPDATE, handleUpdate);', 'ownerDocument.addEventListener(CONTEXT_UPDATE, handleUpdate);')
		.replace('document.removeEventListener(CONTEXT_UPDATE, handleUpdate);\n    }, []);', 'ownerDocument.removeEventListener(CONTEXT_UPDATE, handleUpdate);\n    }, [ownerDocument]);')
		.replace('[context.branches, isPointerEventsEnabled]', '[context.branches, isPointerEventsEnabled, Node]')
		.replace('  } = args;', '  } = args;\n  const window = ownerDocument.defaultView;\n  const Node = window.Node;')
		.replace('function dispatchUpdate() {', 'function dispatchUpdate(document) {\n  const CustomEvent = document.defaultView.CustomEvent;')
		.replace('const target = detail.originalEvent.target;', 'const target = detail.originalEvent.target;\n  const CustomEvent = target.ownerDocument.defaultView.CustomEvent;')
		.source;
}

function adaptRemoveScroll(source) {
	return ownerImport + resourceImport + patchText(source, 'RemoveScroll')
		.replace('var lockStack = [];\n', '')
		.replace('export function RemoveScrollSideCar(props) {', `export function RemoveScrollSideCar(props) {
    var document = useOwnerDocument();
    var window = document.defaultView;
    var setTimeout = window.setTimeout.bind(window);
    var lockStack = documentResource(document, "scroll-locks", () => []);`)
		.replace('lockStack = lockStack.filter(function (inst) { return inst !== Style; });', 'lockStack.splice(lockStack.indexOf(Style), 1);')
		.replace('}, []);', '}, [document]);', 7)
		.replace('[props.inert, props.lockRef.current, props.shards]', '[document, props.inert, props.lockRef.current, props.shards]')
		.replace('function getOutermostShadowParent(node) {', 'function getOutermostShadowParent(node) {\n    var ShadowRoot = node.ownerDocument.defaultView.ShadowRoot;')
		.source;
}

function adaptHandleScroll(source) {
	return patchText(source, 'handleScroll')
		.replace('var elementCanBeScrolled = function (node, overflow) {', 'var elementCanBeScrolled = function (node, overflow) {\n    var window = node.ownerDocument.defaultView;\n    var Element = window.Element;')
		.replace('var ownerDocument = node.ownerDocument;', 'var ownerDocument = node.ownerDocument;\n    var ShadowRoot = ownerDocument.defaultView.ShadowRoot;')
		.replace('export var handleScroll = function (axis, endTarget, event, sourceDelta, noOverscroll) {', 'export var handleScroll = function (axis, endTarget, event, sourceDelta, noOverscroll) {\n    var document = endTarget.ownerDocument;\n    var window = document.defaultView;\n    var Node = window.Node;')
		.source;
}

function adaptScrollBar(source) {
	return ownerImport + patchText(source, 'RemoveScrollBar')
		.replace('var getCurrentUseCounter = function () {', 'var getCurrentUseCounter = function (document) {')
		.replace('export var useLockAttribute = function () {', 'export var useLockAttribute = function () {\n    var document = useOwnerDocument();')
		.replace('getCurrentUseCounter()', 'getCurrentUseCounter(document)', 2)
		.replace('}, []);', '}, [document]);')
		.replace('export var RemoveScrollBar = function (_a) {', 'export var RemoveScrollBar = function (_a) {\n    var document = useOwnerDocument();')
		.replace('getGapWidth(gapMode); }, [gapMode]', 'getGapWidth(gapMode, document); }, [gapMode, document]')
		.source;
}

function adaptScrollBarUtils(source) {
	return patchText(source, 'scrollbar gap')
		.replace('var getOffset = function (gapMode) {', 'var getOffset = function (gapMode, document) {\n    var window = document.defaultView;')
		.replace('export var getGapWidth = function (gapMode) {', 'export var getGapWidth = function (gapMode, document) {\n    var window = document.defaultView;')
		.replace('getOffset(gapMode);', 'getOffset(gapMode, document);')
		.source;
}

function adaptStyleHook(source) {
	return ownerImport + patchText(source, 'style singleton hook')
		.replace('var sheet = stylesheetSingleton();', 'var sheets = new WeakMap();')
		.replace('return function (styles, isDynamic) {', 'return function (styles, isDynamic) {\n        var document = useOwnerDocument();')
		.replace('sheet.add(styles);', 'var sheet = sheets.get(document);\n            if (!sheet) { sheet = stylesheetSingleton(document); sheets.set(document, sheet); }\n            sheet.add(styles);')
		.replace('[styles && isDynamic]', '[document, styles && isDynamic]')
		.source;
}

function adaptStyleSingleton(source) {
	return patchText(source, 'style singleton')
		.replace('function makeStyleTag() {', 'function makeStyleTag(document) {')
		.replace('function injectStyles(tag, css) {', 'function injectStyles(tag, css) {\n    var document = tag.ownerDocument;')
		.replace('function insertStyleTag(tag) {', 'function insertStyleTag(tag) {\n    var document = tag.ownerDocument;')
		.replace('export var stylesheetSingleton = function () {', 'export var stylesheetSingleton = function (document) {')
		.replace('stylesheet = makeStyleTag()', 'stylesheet = makeStyleTag(document)')
		.source;
}

// Menu/Select are modal consumers too: keyboard modality, typeahead, geometry,
// native select events and window listeners must use the same document.
function ownerLocals(source, label, anchors) {
	const patch = patchText(source, label);
	for (const anchor of anchors) patch.replace(anchor, `${anchor}\n const document = useOwnerDocument();\n const window = document.defaultView;\n const CustomEvent = window.CustomEvent;\n const Event = window.Event;\n const setTimeout = window.setTimeout.bind(window);`);
	return patch;
}
function adaptMenu(source) {
	return ownerImport + ownerLocals(source, 'Menu', [
		'var Menu = /* @__PURE__ */ __name((props) => {',
		'function MenuContentImpl2(props, forwardedRef) {',
		'function MenuItem2(props, forwardedRef) {',
		'function MenuSubTrigger2(props, forwardedRef) {',
	])
		.replace('function focusFirst(candidates) {', 'function focusFirst(candidates) {\n const document = candidates[0]?.ownerDocument;\n if (!document) return;')
		.replace('  }, []);\n  React.useEffect(() => {\n    if (!open)', '  }, [document]);\n  React.useEffect(() => {\n    if (!open)')
		.replace('[open, handleOpenChange]', '[window, open, handleOpenChange]')
		.source;
}
function adaptSelect(source) {
	return ownerImport + ownerLocals(source, 'Select', [
		'function SelectContentImpl2(props, forwardedRef) {',
		'function SelectItemAlignedPosition2(props, forwardedRef) {',
		'function SelectViewport2(props, forwardedRef) {',
		'function SelectItem2(props, forwardedRef) {',
		'function SelectScrollButtonImpl2(props, forwardedRef) {',
		'function SelectBubbleInput2({ __scopeSelect, ...props }, forwardedRef) {',
		'function useTypeaheadSearch(onSearchChange) {',
	])
		.replace('associatedForm instanceof HTMLFormElement', 'associatedForm?.tagName === "FORM"')
		.replace('[handleSearchChange]', '[handleSearchChange, window]')
		.replace('const resetTypeahead = React.useCallback(() => {\n    searchRef.current = "";\n    window.clearTimeout(timerRef.current);\n  }, []);', 'const resetTypeahead = React.useCallback(() => {\n    searchRef.current = "";\n    window.clearTimeout(timerRef.current);\n  }, [window]);')
		.replace('return () => window.clearTimeout(timerRef.current);\n  }, []);', 'return () => window.clearTimeout(timerRef.current);\n  }, [window]);')
		.source;
}

function adaptRovingFocus(source) {
	return patchText(source, 'RovingFocus')
		.replace('function focusFirst(candidates, preventScroll = false) {', 'function focusFirst(candidates, preventScroll = false) {\n const document = candidates[0]?.ownerDocument;\n if (!document) return;')
		.replace('new CustomEvent(ENTRY_FOCUS, EVENT_OPTIONS)', 'new event.currentTarget.ownerDocument.defaultView.CustomEvent(ENTRY_FOCUS, EVENT_OPTIONS)')
		.replace('setTimeout(() => focusFirst(candidateNodes));', 'event.currentTarget.ownerDocument.defaultView.setTimeout(() => focusFirst(candidateNodes));')
		.source;
}

/** Exact released entry paths and counts are asserted even if a future package
 * renames an entry, changes ESM to CJS or introduces another dependency copy. */
export const modalTransforms = {
	'@radix-ui/react-roving-focus/dist/index.mjs': adaptRovingFocus,
	'@radix-ui/react-menu/dist/index.mjs': adaptMenu,
	'@radix-ui/react-select/dist/index.mjs': adaptSelect,
	'@radix-ui/react-focus-scope/dist/index.mjs': adaptFocusScope,
	'@radix-ui/react-focus-guards/dist/index.mjs': adaptFocusGuards,
	'@radix-ui/react-dismissable-layer/dist/index.mjs': adaptDismissableLayer,
	'react-remove-scroll/dist/es2015/SideEffect.js': adaptRemoveScroll,
	'react-remove-scroll/dist/es2015/handleScroll.js': adaptHandleScroll,
	'react-remove-scroll-bar/dist/es2015/component.js': adaptScrollBar,
	'react-remove-scroll-bar/dist/es2015/utils.js': adaptScrollBarUtils,
	'react-style-singleton/dist/es2015/hook.js': adaptStyleHook,
	'react-style-singleton/dist/es2015/singleton.js': adaptStyleSingleton,
};
export const radixOwnerDocument = guardedAdapter('radix-owner-document', modalTransforms);
