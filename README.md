# Wisadel

Wisadel is a Windows desktop AI workspace combining streaming chat and Stable Diffusion image generation.

## Local development

Prerequisites: Node.js 22+, npm 10+. Docker is optional when using the default in-memory development mode.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

- Desktop web preview: http://localhost:5173
- Admin console: http://localhost:5174
- API: http://localhost:3000/api/v1
- API health: http://localhost:3000/api/v1/health

The default `DATA_MODE=memory` and `AI_MODE=mock` provide a runnable local experience without external services. Production integration uses PostgreSQL, Redis, DeepSeek, Qwen and A1111 through environment variables.

## Workspace

- `apps/api`: NestJS API and image job orchestration
- `apps/desktop`: Electron + React desktop client
- `apps/admin`: Internal administration console
- `packages/contracts`: Shared schemas and API types

Never commit API keys. Previously exposed credentials must be revoked before use.
