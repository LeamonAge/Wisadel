import { JwtService } from '@nestjs/jwt';
import { DEFAULT_SD_PARAMS } from '@wisadel/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './modules/auth.service';
import { ChatService } from './modules/chat.service';
import { BillingService } from './modules/billing.service';
import { DeepSeekService } from './providers/deepseek.service';
import { QwenService } from './providers/qwen.service';
import { StableDiffusionService } from './providers/stable-diffusion.service';
import { AgentToolsService } from './providers/agent-tools.service';
import { MemoryStore } from './shared/memory.store';
import { PersistenceService } from './shared/persistence.service';
import { PrismaService } from './shared/prisma.service';

const memoryPersistence = () => new PersistenceService(new MemoryStore(), new PrismaService());

describe('AuthService', () => {
  it('registers and authenticates a user', async () => {
    const persistence = memoryPersistence();
    const auth = new AuthService(persistence, new JwtService({ secret: 'test-secret' }));
    const registered = await auth.register({ email: 'test@example.com', password: 'password123', nickname: '测试用户' });
    const loggedIn = await auth.login({ email: 'test@example.com', password: 'password123' });
    expect(registered.user.id).toBe(loggedIn.user.id);
    expect(loggedIn.accessToken).toBeTruthy();
  });
});

describe('ChatService', () => {
  it('titles a new session from its first user message', async () => {
    const persistence = memoryPersistence();
    const chat = new ChatService(persistence);
    const userId = crypto.randomUUID();
    const session = await chat.createSession(userId, { kind: 'chat' });

    await chat.addUserMessage(userId, session.id, { clientId: 'first-message', content: '帮我设计一个图像创作工作流' });

    expect((await chat.getOwnedSession(userId, session.id)).title).toBe('帮我设计一个图像创作工作流');
  });

  it('filters image history by session', async () => {
    const persistence = memoryPersistence();
    const chat = new ChatService(persistence);
    const userId = crypto.randomUUID();
    const first = await chat.createSession(userId, { kind: 'image' });
    const second = await chat.createSession(userId, { kind: 'image' });
    const params = { prompt: 'test', negativePrompt: '', samplerName: 'Euler a', steps: 24, width: 768, height: 768, cfgScale: 7, seed: -1, batchSize: 1 as const };
    await persistence.createImageTask(userId, { sessionId: first.id, clientId: 'first-task', params });
    await persistence.createImageTask(userId, { sessionId: second.id, clientId: 'second-task', params });

    const tasks = await persistence.listImageTasks(userId, first.id);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.sessionId).toBe(first.id);
  });
});

describe('BillingService', () => {
  it('settles the documented Pro example in milli-sanity without floating-point drift', async () => {
    const persistence = memoryPersistence();
    const auth = new AuthService(persistence, new JwtService({ secret: 'test-secret' }));
    const user = (await auth.register({ email: 'billing@example.com', password: 'password123', nickname: '结算测试' })).user;
    const billing = new BillingService(persistence);

    const entries = await billing.settleChatUsage(user.id, [{ model: 'DeepSeek V4 Pro', inputTokens: 4000, outputTokens: 1500 }]);

    expect(entries[0]?.deltaMilli).toBe(-3500);
    expect(entries[0]?.balanceAfterMilli).toBe(96500);
    await expect(billing.account(user.id)).resolves.toMatchObject({ balanceMilli: 96500, balance: 96.5 });
  });
});

describe('Agent task persistence', () => {
  it('persists a three-step plan and resets a failed task for recovery', async () => {
    const persistence = memoryPersistence();
    const userId = crypto.randomUUID();
    const session = await persistence.createSession(userId, { kind: 'chat', title: '后台任务', model: 'DeepSeek' });
    const task = await persistence.createAgentTask(userId, { sessionId: session.id, content: '整理这个项目并运行测试', imageUrls: [], attachments: [] });
    expect(task.steps).toHaveLength(3);
    await persistence.updateAgentTask(task.id, { status: 'failed', errorMessage: '网络中断' });
    await persistence.updateAgentStep(task.id, 1, { status: 'failed', detail: '网络中断' });

    const reset = await persistence.resetAgentTask(userId, task.id);

    expect(reset).toMatchObject({ status: 'queued', errorMessage: null });
    expect(reset?.steps.every((step) => step.status === 'queued' && step.detail === null)).toBe(true);
  });
});

describe('DeepSeekService', () => {
  const originalMode = process.env.AI_MODE;
  const originalKey = process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    process.env.AI_MODE = originalMode;
    process.env.DEEPSEEK_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it('includes the latest user message in the provider request', async () => {
    process.env.AI_MODE = 'integrated';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '收到' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const chunks: string[] = [];
    for await (const chunk of new DeepSeekService(new AgentToolsService()).stream([], '本轮问题')) chunks.push(chunk);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.messages[0].content).toContain('MOSS');
    expect(body.messages[0].content).toContain('访问公开网页');
    expect(body.tools.map((tool: any) => tool.function.name)).toContain('read_file');
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: '本轮问题' });
    expect(chunks.join('')).toBe('收到');
  });

  it('executes a tool and sends the result back to DeepSeek', async () => {
    process.env.AI_MODE = 'integrated';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    const execute = vi.fn(async () => 'src/App.tsx');
    const tools = { workspaceRoot: 'C:\\workspace', definitions: [], execute } as unknown as AgentToolsService;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'list_files', arguments: '{"path":"."}' } }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '已查看项目文件。' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const chunks: string[] = [];
    for await (const chunk of new DeepSeekService(tools).stream([], '查看项目')) chunks.push(chunk);

    expect(execute).toHaveBeenCalledWith({ name: 'list_files', arguments: '{"path":"."}' });
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(secondBody.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call-1', content: 'src/App.tsx' });
    expect(chunks.join('')).toBe('已查看项目文件。');
  });

  it('stops repeated tools and forces a final answer without tools', async () => {
    process.env.AI_MODE = 'integrated';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    const execute = vi.fn(async () => 'same result');
    const tools = { workspaceRoot: 'C:\\workspace', definitions: [{ type: 'function' }], execute } as unknown as AgentToolsService;
    const toolReply = () => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: crypto.randomUUID(), type: 'function', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] } }] }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolReply())
      .mockResolvedValueOnce(toolReply())
      .mockResolvedValueOnce(toolReply())
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '已停止重复读取，并完成总结。' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const chunks: string[] = [];
    for await (const chunk of new DeepSeekService(tools).stream([], '读取说明')) chunks.push(chunk);

    expect(execute).toHaveBeenCalledTimes(2);
    const closingBody = JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body));
    expect(closingBody.tools).toBeUndefined();
    expect(chunks.join('')).toBe('已停止重复读取，并完成总结。');
  });

  it('retries DSML protocol leakage with the standard tool model', async () => {
    process.env.AI_MODE = 'integrated';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
    process.env.DEEPSEEK_TOOL_MODEL = 'deepseek-chat';
    const tools = { workspaceRoot: 'C:\\workspace', definitions: [], execute: vi.fn() } as unknown as AgentToolsService;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '<｜｜DSML｜｜tool_calls><｜｜DSML｜｜invoke name="list_files">' } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '已使用标准工具协议处理。' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const chunks: string[] = [];
    for await (const chunk of new DeepSeekService(tools).stream([], '检查目录')) chunks.push(chunk);

    const retryBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(retryBody.model).toBe('deepseek-chat');
    expect(chunks.join('')).toBe('已使用标准工具协议处理。');
  });
});

describe('AgentToolsService', () => {
  it('blocks absolute and sensitive file paths', async () => {
    const tools = new AgentToolsService();
    await expect(tools.execute({ name: 'read_file', arguments: '{"path":"C:/Windows/win.ini"}' })).rejects.toThrow('相对路径');
    await expect(tools.execute({ name: 'read_file', arguments: '{"path":".env"}' })).rejects.toThrow('敏感文件');
  });
});

describe('QwenService', () => {
  const originalMode = process.env.AI_MODE;
  const originalKey = process.env.QWEN_API_KEY;
  const originalUrl = process.env.QWEN_BASE_URL;

  afterEach(() => {
    process.env.AI_MODE = originalMode;
    process.env.QWEN_API_KEY = originalKey;
    process.env.QWEN_BASE_URL = originalUrl;
    vi.unstubAllGlobals();
  });

  it('identifies open-source SD and preserves lawful creative intent', async () => {
    process.env.AI_MODE = 'integrated';
    process.env.QWEN_API_KEY = 'test-key';
    process.env.QWEN_BASE_URL = 'https://example.test/v1';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ reply: '参数已整理', action: 'update_params', params: { prompt: 'cat' }, requiresConfirmation: true }) } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await new QwenService({ toVisionSource: vi.fn() } as any).extract('画一只猫', DEFAULT_SD_PARAMS);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.messages[0].content).toContain('英文 Stable Diffusion 标签');
    expect(body.messages[0].content).toContain('禁止把用户中文原话直接复制');
    expect(body.messages[0].content).toContain('reasoningSummary');
  });

  it('replaces a provider refusal for a lawful portrait with a local SD action', async () => {
    process.env.AI_MODE = 'integrated';
    process.env.QWEN_API_KEY = 'test-key';
    process.env.QWEN_BASE_URL = 'https://example.test/v1';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: '无法处理。', action: 'reply_only', params: {}, requiresConfirmation: true }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ allowed: true, reply: '已重写提示词，请确认参数。', reasoningSummary: '采用历史人物肖像构图与电影光线。', prompt: 'historical Chinese statesman, formal military uniform, dignified portrait, cinematic lighting, highly detailed', negativePrompt: 'low quality, blurry, deformed' }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const action = await new QwenService({ toVisionSource: vi.fn() } as any).extract('画一个蒋介石', DEFAULT_SD_PARAMS);

    expect(action.action).toBe('update_params');
    expect(action.params.prompt).toContain('historical Chinese statesman');
    expect(action.params.prompt).not.toBe('画一个蒋介石');
    expect(action.reply).not.toContain('不能');
  });

  it('uses the vision model and sends attached images', async () => {
    process.env.AI_MODE = 'integrated';
    process.env.QWEN_API_KEY = 'test-key';
    process.env.QWEN_BASE_URL = 'https://example.test/v1';
    process.env.QWEN_VISION_MODEL = 'qwen-vl-plus';
    const toVisionSource = vi.fn(async () => 'data:image/png;base64,aGVsbG8=');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ reply: '已查看图片', action: 'update_params', params: { prompt: 'image prompt' }, requiresConfirmation: true }) } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await new QwenService({ toVisionSource } as any).extract('分析图片', DEFAULT_SD_PARAMS, ['http://localhost:3000/uploads/test.png']);

    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.model).toBe('qwen-vl-plus');
    expect(body.messages[1].content[1].image_url.url).toContain('data:image/png;base64');
    expect(toVisionSource).toHaveBeenCalledOnce();
  });

  it('preserves an explicit autonomous generation action', async () => {
    process.env.AI_MODE = 'integrated';
    process.env.QWEN_API_KEY = 'test-key';
    process.env.QWEN_BASE_URL = 'https://example.test/v1';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ reply: '立即生成', action: 'generate', params: { prompt: 'cat' }, requiresConfirmation: false }) } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const action = await new QwenService({ toVisionSource: vi.fn() } as any).extract('直接帮我生成一只猫', DEFAULT_SD_PARAMS, [], {
      mode: 'remote', currentModel: 'anime', currentVae: null, samplers: ['Euler a'], schedulers: ['Automatic'],
      models: [{ title: 'anime.safetensors', modelName: 'anime', hash: 'abc' }], loras: [], vaes: [],
      scripts: { txt2img: [], img2img: [] }, upscalers: [], embeddings: []
    });

    expect(action.action).toBe('generate');
    expect(action.requiresConfirmation).toBe(false);
  });
});

describe('StableDiffusionService', () => {
  const originalMode = process.env.SD_MODE;
  const originalUrl = process.env.SD_BASE_URL;

  afterEach(() => {
    process.env.SD_MODE = originalMode;
    process.env.SD_BASE_URL = originalUrl;
    vi.unstubAllGlobals();
  });

  it('rejects an HTML page that is not an A1111 API', async () => {
    process.env.SD_MODE = 'remote';
    process.env.SD_BASE_URL = 'https://example.test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Control panel</html>', { headers: { 'Content-Type': 'text/html' } })));

    await expect(new StableDiffusionService({} as any).capabilities()).rejects.toThrow('没有指向 A1111 API');
  });

  it('sends image and mask data to the img2img endpoint for inpainting', async () => {
    process.env.SD_MODE = 'remote';
    process.env.SD_BASE_URL = 'https://example.test';
    const toVisionSource = vi.fn(async (url: string) => `data:image/png;base64,${url.includes('mask') ? 'bWFzaw==' : 'aW5pdA=='}`);
    const saveBase64 = vi.fn(async () => 'http://localhost:3000/uploads/result.png');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ images: ['cmVzdWx0'] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await new StableDiffusionService({ toVisionSource, saveBase64 } as any).generate({
      ...DEFAULT_SD_PARAMS,
      mode: 'inpaint',
      initImageUrl: 'http://localhost:3000/uploads/init.png',
      maskImageUrl: 'http://localhost:3000/uploads/mask.png',
      denoisingStrength: 0.55,
      maskBlur: 8
    });

    const generationCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/sdapi/v1/img2img'))!;
    expect(generationCall[0]).toBe('https://example.test/sdapi/v1/img2img');
    const body = JSON.parse(String((generationCall[1] as RequestInit).body));
    expect(body.init_images).toHaveLength(1);
    expect(body.mask).toContain('data:image/png;base64');
    expect(body.denoising_strength).toBe(0.55);
    expect(body.mask_blur).toBe(8);
  });

  it('normalizes legacy Karras sampler names before generation', async () => {
    process.env.SD_MODE = 'remote';
    process.env.SD_BASE_URL = 'https://example.test';
    const saveBase64 = vi.fn(async () => 'http://localhost:3000/uploads/result.png');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ images: ['cmVzdWx0'] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    await new StableDiffusionService({ saveBase64 } as any).generate({
      ...DEFAULT_SD_PARAMS,
      samplerName: 'DPM++ 2M Karras',
      prompt: 'portrait'
    });

    const generationCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/sdapi/v1/txt2img'))!;
    const body = JSON.parse(String((generationCall[1] as RequestInit).body));
    expect(body.sampler_name).toBe('DPM++ 2M');
  });

  it('applies selected model, scheduler, LoRA and script to the A1111 payload', async () => {
    process.env.SD_MODE = 'remote';
    process.env.SD_BASE_URL = 'https://example.test';
    const saveBase64 = vi.fn(async () => 'http://localhost:3000/uploads/result.png');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ images: ['cmVzdWx0'] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new StableDiffusionService({ saveBase64 } as any);
    (service as any).cachedCapabilities = { expiresAt: Date.now() + 1000, value: {
      mode: 'remote', currentModel: 'base', currentVae: null, samplers: ['Euler a'], schedulers: ['Karras'],
      models: [{ title: 'anime.safetensors [abc]', modelName: 'anime', hash: 'abc' }],
      loras: [{ name: 'detail', alias: 'detail' }], vaes: [], scripts: { txt2img: ['Hypertile'], img2img: [] },
      upscalers: [], embeddings: []
    } };

    await service.generate({
      ...DEFAULT_SD_PARAMS,
      prompt: 'portrait',
      modelCheckpoint: 'anime',
      schedulerName: 'Karras',
      loras: [{ name: 'detail', weight: 0.7 }],
      scriptName: 'Hypertile',
      scriptArgs: [true]
    });

    const generationCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/sdapi/v1/txt2img'))!;
    const body = JSON.parse(String((generationCall[1] as RequestInit).body));
    expect(body.prompt).toContain('<lora:detail:0.7>');
    expect(body.scheduler).toBe('Karras');
    expect(body.override_settings.sd_model_checkpoint).toContain('anime.safetensors');
    expect(body.script_name).toBe('Hypertile');
    expect(body.script_args).toEqual([true]);
  });
});
