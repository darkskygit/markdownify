import type { BrowserWorker } from '@cloudflare/puppeteer'

export type RouterHandler<E> = (request: Request, env: E, ctx: ExecutionContext) => Promise<Response>
export type HostHandlers<E> = Record<string, RouterHandler<E>>
export type DomainRouters<E> = Record<string, HostHandlers<E>>

export interface Env {
	BROWSER: BrowserWorker
}
