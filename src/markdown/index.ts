import type { IRequest } from 'itty-router';

import type { Env } from '../types';
import { fixUrl } from '../utils';

import { htmlToMarkdown } from './format';
import { getBrowser, newPage } from './browser';

function pruneQuery(query: string[] | string | undefined) {
	return Array.isArray(query) ? query[0] : query || '';
}

export async function handlePageMarkdown(request: IRequest, env: Env) {
	const url = fixUrl(pruneQuery(request.query.url));
	if (!url) return new Response('Invalid URL', { status: 400 });
	url.hash = '';

	const cacheKey = new Request(url.href, { headers: {} });
	const cache = caches.default;
	let response = await cache.match(cacheKey);
	if (!response) {
		const browser = await getBrowser(env.BROWSER);

		let markdown;
		try {
			const page = await newPage(browser);
			const response = await page.goto(url.toString().toLowerCase(), {
				waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
				timeout: 10_000,
			});
			markdown = await htmlToMarkdown(url, page, response!);
		} finally {
			// All work done, so free connection (IMPORTANT!)
			await browser.disconnect();
		}

		const response = new Response(markdown.toString(), {
			headers: {
				'content-type': 'text/plain; charset=utf-8',
			},
		});
		await cache.put(cacheKey, response.clone());

		return response;
	} else {
		return response;
	}
}
