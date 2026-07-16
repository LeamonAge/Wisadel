import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
  details: z.record(z.unknown()).optional()
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nickname: z.string().min(1).max(50),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(['user', 'admin']),
  createdAt: z.string().datetime()
});

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  nickname: z.string().trim().min(1).max(50)
});

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128)
});

export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  refreshToken: z.string()
});

export const sessionKindSchema = z.enum(['chat', 'image']);

export const sessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  kind: sessionKindSchema,
  model: z.string(),
  preview: z.string(),
  updatedAt: z.string().datetime()
});

export const messageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export const messageStatusSchema = z.enum(['sending', 'sent', 'failed']);
export const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().min(0).max(20 * 1024 * 1024)
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().min(1).max(100),
  sessionId: z.string().uuid(),
  role: messageRoleSchema,
  content: z.string(),
  status: messageStatusSchema,
  imageUrls: z.array(z.string().url()).max(4).default([]),
  attachments: z.array(attachmentSchema).max(8).default([]),
  createdAt: z.string().datetime()
});

export const createSessionInputSchema = z.object({
  kind: sessionKindSchema,
  title: z.string().trim().min(1).max(100).optional()
});

export const imageModeSchema = z.enum(['txt2img', 'img2img', 'inpaint']);
export const sdLoraSchema = z.object({
  name: z.string().min(1).max(200),
  weight: z.number().min(-2).max(2).default(0.8)
});
export const sdParamsSchema = z.object({
  mode: imageModeSchema.default('txt2img'),
  prompt: z.string().max(4000).default(''),
  negativePrompt: z.string().max(2000).default(''),
  samplerName: z.string().min(1).max(100).default('Euler a'),
  steps: z.number().int().min(1).max(80).default(24),
  width: z.number().int().min(256).max(1536).multipleOf(64).default(768),
  height: z.number().int().min(256).max(1536).multipleOf(64).default(768),
  cfgScale: z.number().min(1).max(20).default(7),
  seed: z.number().int().min(-1).max(2_147_483_647).default(-1),
  batchSize: z.literal(1).default(1),
  initImageUrl: z.string().url().nullable().default(null),
  maskImageUrl: z.string().url().nullable().default(null),
  denoisingStrength: z.number().min(0).max(1).default(0.65),
  maskBlur: z.number().int().min(0).max(64).default(4),
  modelCheckpoint: z.string().min(1).max(300).nullable().default(null),
  vaeName: z.string().min(1).max(300).nullable().default(null),
  schedulerName: z.string().min(1).max(100).nullable().default(null),
  loras: z.array(sdLoraSchema).max(8).default([]),
  scriptName: z.string().min(1).max(200).nullable().default(null),
  scriptArgs: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).max(32).default([])
});

export const sdCapabilitiesSchema = z.object({
  mode: z.enum(['mock', 'remote']),
  currentModel: z.string().nullable(),
  currentVae: z.string().nullable(),
  samplers: z.array(z.string()),
  schedulers: z.array(z.string()),
  models: z.array(z.object({ title: z.string(), modelName: z.string(), hash: z.string().nullable() })),
  loras: z.array(z.object({ name: z.string(), alias: z.string() })),
  vaes: z.array(z.string()),
  scripts: z.object({ txt2img: z.array(z.string()), img2img: z.array(z.string()) }),
  upscalers: z.array(z.string()),
  embeddings: z.array(z.string())
});

export const createMessageInputSchema = z.object({
  clientId: z.string().min(1).max(100),
  content: z.string().trim().max(20_000),
  imageUrls: z.array(z.string().url()).max(4).default([]),
  attachments: z.array(attachmentSchema).max(8).default([]),
  currentParams: sdParamsSchema.optional()
}).refine((input) => Boolean(input.content || input.attachments.length || input.imageUrls.length), { message: '消息或附件不能为空' });

export const imageTaskStatusSchema = z.enum([
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
]);

export const imageTaskSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  status: imageTaskStatusSchema,
  progress: z.number().int().min(0).max(100),
  params: sdParamsSchema,
  resultUrls: z.array(z.string()),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  retryOfId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createImageTaskInputSchema = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().min(1).max(100),
  params: sdParamsSchema
}).superRefine(({ params }, context) => {
  if (params.mode !== 'txt2img' && !params.initImageUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['params', 'initImageUrl'], message: '图生图和局部重绘需要原图' });
  }
  if (params.mode === 'inpaint' && !params.maskImageUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['params', 'maskImageUrl'], message: '局部重绘需要蒙版' });
  }
});

export const uploadImageResponseSchema = z.object({
  url: z.string().url()
});
export const uploadFileResponseSchema = attachmentSchema;

export const imageAgentActionSchema = z.object({
  reply: z.string().min(1).max(4000),
  reasoningSummary: z.string().max(1000).optional(),
  action: z.enum(['reply_only', 'update_params', 'generate']),
  params: sdParamsSchema.partial().default({}),
  requiresConfirmation: z.boolean().default(true)
});

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  mode: z.enum(['mock', 'integrated']),
  services: z.object({
    api: z.literal('up'),
    database: z.enum(['up', 'mock', 'down']),
    redis: z.enum(['up', 'mock', 'down']),
    deepseek: z.enum(['configured', 'mock', 'unavailable']),
    qwen: z.enum(['configured', 'mock', 'unavailable']),
    stableDiffusion: z.enum(['configured', 'mock', 'unavailable'])
  })
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type User = z.infer<typeof userSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionKind = z.infer<typeof sessionKindSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export type SdParams = z.infer<typeof sdParamsSchema>;
export type SdCapabilities = z.infer<typeof sdCapabilitiesSchema>;
export type SdLora = z.infer<typeof sdLoraSchema>;
export type ImageMode = z.infer<typeof imageModeSchema>;
export type ImageTask = z.infer<typeof imageTaskSchema>;
export type ImageTaskStatus = z.infer<typeof imageTaskStatusSchema>;
export type CreateImageTaskInput = z.infer<typeof createImageTaskInputSchema>;
export type UploadImageResponse = z.infer<typeof uploadImageResponseSchema>;
export type UploadFileResponse = z.infer<typeof uploadFileResponseSchema>;
export type ImageAgentAction = z.infer<typeof imageAgentActionSchema>;
export type Health = z.infer<typeof healthSchema>;

export const DEFAULT_SD_PARAMS: SdParams = sdParamsSchema.parse({});
