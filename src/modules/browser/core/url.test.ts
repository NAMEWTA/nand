import { describe, expect, it } from 'vitest';
import { normalizeBrowserNavigationUrl as url, buildSearchUrl, validSearchTemplate } from './url';
describe('address input rules', () => {
	it.each([
		['', 'about:blank'],
		['about:blank', 'about:blank'],
		['localhost:3000/a', 'http://localhost:3000/a'],
		['127.0.0.1:80', 'http://127.0.0.1/'],
		['0.0.0.0', 'http://0.0.0.0/'],
		['[::1]:8080/x', 'http://[::1]:8080/x'],
		['/tmp/a b.html', 'file:///tmp/a%20b.html'],
		['C:\\a b\\x.html', 'file:///C:/a%20b/x.html'],
		['\\\\server\\share\\a b', 'file://server/share/a%20b'],
		['myserver:8080', 'https://myserver:8080/'],
		['https://a.cn/x', 'https://a.cn/x'],
		['file:///tmp/x', 'file:///tmp/x'],
		['a.cn/x', 'https://a.cn/x'],
		['react hooks', 'https://www.google.com/search?q=react%20hooks'],
		['react', 'https://www.google.com/search?q=react'],
	])('%s', (input, expected) => expect(url(input, 'google')).toBe(expected));
	it.each([
		'javascript:alert(1)',
		'data:text/html,x',
		'chrome:settings',
		'https://u:p@example.com',
		'u:p@example.com',
		'http://a@b.com',
	])('rejects %s', (input) => expect(url(input, 'google')).toBeNull());
	it('encodes Baidu and custom queries and validates templates', () => {
		expect(buildSearchUrl('中 &文', 'baidu')).toBe('https://www.baidu.com/s?wd=%E4%B8%AD%20%26%E6%96%87');
		expect(buildSearchUrl('a&b', 'custom', 'https://search.test/?q=%s')).toBe('https://search.test/?q=a%26b');
		for (const template of ['http://a/?q=%s', 'https://a/', 'https://u:p@a/?q=%s'])
			expect(validSearchTemplate(template)).toBe(false);
	});
});
