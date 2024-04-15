import { getDomain, getSubdomain } from 'tldts';

import { respNotFound } from './response';
import type { DomainRouters, RouterHandler } from './types';

export class DomainRouterBuilder<E> {
	private routers: DomainRouters<E> = {};

	static create<E>(): DomainRouterBuilder<E> {
		return new DomainRouterBuilder();
	}

	public add(host: string, path: string, handler: RouterHandler<E>) {
		const hostRouter = this.routers[host] || {};
		hostRouter[path] = handler;
		this.routers[host] = hostRouter;

		return this;
	}
	public build(): DomainRouters<E> {
		return this.routers;
	}
}

export async function domainRoutersHandler<E>(
	routers: DomainRouters<E>,
	request: Request,
	env: E,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);

	const routerHandlers = routers[url.hostname];
	if (routerHandlers) {
		for (const key in routerHandlers) {
			if (url.pathname.startsWith(key)) {
				const handler = routerHandlers[key];
				return handler(request, env, ctx);
			}
		}
	}
	return respNotFound();
}

export function fixUrl(url: string): URL | null {
	if (typeof url !== 'string') {
		return null;
	}

	let fullUrl = url;

	// don't require // prefix, URL can handle protocol:domain
	if (!url.startsWith('http:') && !url.startsWith('https:')) {
		fullUrl = 'http://' + url;
	}

	try {
		const parsed = new URL(fullUrl);

		const subDomain = getSubdomain(url);
		const mainDomain = getDomain(url);
		const fullDomain = subDomain ? `${subDomain}.${mainDomain}` : mainDomain;

		if (
			['http:', 'https:'].includes(parsed.protocol) &&
			// check hostname is a valid domain
			fullDomain === parsed.hostname
		) {
			return parsed;
		}
	} catch (_) {}

	return null;
}

export function log(message: string | object, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', data?: object) {
	console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...data }));
}
