export default {
	async fetch(request: Request): Promise<Response> {
		return new Response('ok', { status: 200 })
	},
}
