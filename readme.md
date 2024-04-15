## Markdownify

converts any URL to an LLM-friendly input with simple request, run in Cloudflare Worker at no cost and easy to deploy.

Inspire by [reader](https://github.com/jina-ai/reader)

Demo: https://markdownify.darksky2048.workers.dev/api/markdown?url=some-url

- [markdownify github docs](https://markdownify.darksky2048.workers.dev/api/markdown?url=https://docs.github.com/en/get-started/start-your-journey/about-github-and-git)
- [markdownify about google](https://markdownify.darksky2048.workers.dev/api/markdown?url=https://about.google)
- [markdownify twitter](https://markdownify.darksky2048.workers.dev/api/markdown?url=https://x.com/elonmusk)

## Usage

```bash
curl https://markdownify.YOUR-USERNAME.workers.dev/api/markdown?url=https://about.google
```

## Install

You will need the following tools to run the project:

Node v20

```bash
# prepare the environment
corepack enable pnpm
pnpm install

# login your cloudflare account
npx wrangler login

# publish the worker
pnpm run deploy

# test the worker
curl https://markdownify.YOUR-USERNAME.workers.dev/api/markdown?url=https://about.google
```

## License

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)
