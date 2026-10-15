// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/rss-opml.ts
/**
 * OPML 2.0 subscription interchange (pure functions, html-md's tokenizer does
 * the XML-ish parse — outline elements are plain tags with attributes).
 *
 * Export nests feeds under one outline per group (ungrouped feeds at the
 * top level), the shape every reader (Inoreader / Feedly / Follow /
 * NetNewsWire / …) imports as folders/categories. Import walks the same
 * shape back: a nested outline without an xmlUrl is a category, a leaf with
 * one is a feed.
 */

import { findTag, parseHtml, type HtmlElementNode, type HtmlNode } from './html-md';
import { normalizeWebUrl, isValidWebUrl } from './url';
import type { RssFeedSource } from '../board/types';

/** Attribute keys arrive lower-cased from the tokenizer (xmlUrl → xmlurl). */
const attr = (node: HtmlElementNode, name: string): string => node.attrs[name.toLowerCase()] ?? '';

/** XML-escape a text/attribute value. */
function xmlEscape(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface OpmlExportInput {
	feeds: ReadonlyArray<RssFeedSource>;
	/** Effective group order (rssGroupNames); optional — derived labels only. */
	groups?: ReadonlyArray<string>;
}

/** Build an OPML 2.0 document for the section's subscriptions. */
export function buildOpml(input: OpmlExportInput): string {
	const lines: string[] = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<opml version="2.0">',
		'  <head>',
		'    <title>NAND RSS subscriptions</title>',
		'  </head>',
		'  <body>',
	];
	const groups = input.groups ?? [];
	const grouped = new Map<string, RssFeedSource[]>();
	const loose: RssFeedSource[] = [];
	for (const feed of input.feeds) {
		const group = feed.group?.trim();
		if (group) {
			const bucket = grouped.get(group) ?? [];
			bucket.push(feed);
			grouped.set(group, bucket);
		} else {
			loose.push(feed);
		}
	}
	// Group order: the managed list first, then any label only feeds carry.
	const orderedGroups = [
		...groups.filter((group) => grouped.has(group)),
		...[...grouped.keys()].filter((group) => !groups.includes(group)),
	];
	const outline = (feed: RssFeedSource, indent: string): void => {
		const label = feed.name?.trim() || feed.url;
		lines.push(
			`${indent}<outline type="rss" text="${xmlEscape(label)}" title="${xmlEscape(label)}" xmlUrl="${xmlEscape(feed.url)}"/>`,
		);
	};
	for (const group of orderedGroups) {
		lines.push(`    <outline text="${xmlEscape(group)}" title="${xmlEscape(group)}">`);
		for (const feed of grouped.get(group) ?? []) outline(feed, '      ');
		lines.push('    </outline>');
	}
	for (const feed of loose) outline(feed, '    ');
	lines.push('  </body>');
	lines.push('</opml>');
	return `${lines.join('\n')}\n`;
}

export interface OpmlImportResult {
	/** Parsed feeds (category outline label assigned as group). */
	feeds: RssFeedSource[];
	/** Category labels in document order (candidate group names). */
	groups: string[];
}

/** Parse an OPML document: leaves with xmlUrl are feeds; ancestor outlines
 *  without one are their categories. Malformed input yields empty results,
 *  never a throw. */
export function parseOpml(text: string): OpmlImportResult {
	const out: OpmlImportResult = { feeds: [], groups: [] };
	let roots: HtmlNode[];
	try {
		const nodes = parseHtml(text);
		const body = findTag(nodes, 'body');
		roots = body ? body.children : nodes;
	} catch {
		return out;
	}
	const walk = (list: HtmlNode[], category: string): void => {
		for (const node of list) {
			if (node.type !== 'element' || node.tag !== 'outline') continue;
			const xmlUrl = attr(node, 'xmlurl').trim();
			const label = (attr(node, 'text') || attr(node, 'title')).trim();
			if (xmlUrl) {
				out.feeds.push({
					...(label && label !== xmlUrl ? { name: label } : {}),
					url: xmlUrl,
					...(category ? { group: category } : {}),
				});
				continue;
			}
			// Category (or nested container): its label groups the children.
			const nextCategory = category || label;
			if (label && !out.groups.includes(label)) out.groups.push(label);
			walk(node.children, nextCategory);
		}
	};
	walk(roots, '');
	const seen = new Set<string>();
	out.feeds = out.feeds.flatMap((feed) => {
		const url = normalizeWebUrl(feed.url);
		if (!isValidWebUrl(url) || seen.has(url)) return [];
		seen.add(url);
		return [{ ...feed, url }];
	});
	return out;
}
