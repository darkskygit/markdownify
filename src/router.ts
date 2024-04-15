import { Router } from 'itty-router';

import { handlePageMarkdown } from './markdown';
import { respMethodNotAllowed } from './response';
import type { Env, RouterHandler } from './types';

export function MarkdownifyRouter(): RouterHandler<Env> {
	const router = Router();

	router.get('/api/markdown', handlePageMarkdown);
	router.all('*', () => respMethodNotAllowed());

	return (request: Request, env: Env, ctx: ExecutionContext) => {
		return router.handle(request, env, ctx);
	};
}
