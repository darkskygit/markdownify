import { DomainRouterBuilder, domainRoutersHandler } from './utils';

import { MarkdownifyRouter } from './router';
import type { Env } from './types';

const markdownify = MarkdownifyRouter();

const DEV_WORKER_SCOPE = 'darksky2048';

const routers = DomainRouterBuilder.create<Env>()
	// apis
	.add(`markdownify.${DEV_WORKER_SCOPE}.workers.dev`, '/', markdownify)
	.add('localhost', '/', markdownify)
	.add('127.0.0.1', '/', markdownify)
	.build();

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			return await domainRoutersHandler(routers, request, env, ctx);
		} catch (e: any) {
			return new Response(
				JSON.stringify({
					success: false,
					message: e.message || e.toString(),
				}),
				{ status: 500 },
			);
		}
	},
};
