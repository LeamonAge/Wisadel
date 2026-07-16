import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DEFAULT_SD_PARAMS, type SdCapabilities, type SdParams } from '@wisadel/contracts';
import { ImageStorageService } from '../shared/image-storage.service';

@Injectable()
export class StableDiffusionService {
  private cachedCapabilities?: { expiresAt: number; value: SdCapabilities };

  constructor(private readonly images: ImageStorageService) {}

  get configured() { return (process.env.SD_MODE ?? 'mock') === 'remote' && Boolean(process.env.SD_BASE_URL); }

  async capabilities(): Promise<SdCapabilities> {
    if (!this.configured) return {
      mode: 'mock', currentModel: null, currentVae: null,
      samplers: ['Euler a', 'DPM++ 2M', 'UniPC'], schedulers: ['Automatic'], models: [], loras: [], vaes: [],
      scripts: { txt2img: [], img2img: [] }, upscalers: [], embeddings: []
    };
    if (this.cachedCapabilities && this.cachedCapabilities.expiresAt > Date.now()) return this.cachedCapabilities.value;
    const [samplers, models, loras, vaes, schedulers, scripts, upscalers, embeddings, options] = await Promise.all([
      this.getArray('/sdapi/v1/samplers'), this.getArray('/sdapi/v1/sd-models'), this.getArray('/sdapi/v1/loras'),
      this.getArray('/sdapi/v1/sd-vae'), this.getArray('/sdapi/v1/schedulers'), this.getJson('/sdapi/v1/scripts'),
      this.getArray('/sdapi/v1/upscalers'), this.getJson('/sdapi/v1/embeddings'), this.getJson('/sdapi/v1/options')
    ]);
    const value: SdCapabilities = {
      mode: 'remote',
      currentModel: typeof options.sd_model_checkpoint === 'string' ? options.sd_model_checkpoint : null,
      currentVae: typeof options.sd_vae === 'string' ? options.sd_vae : null,
      samplers: samplers.map((item: any) => String(item.name)).filter(Boolean),
      schedulers: schedulers.map((item: any) => String(item.label ?? item.name)).filter(Boolean),
      models: models.map((item: any) => ({ title: String(item.title), modelName: String(item.model_name), hash: item.hash ? String(item.hash) : null })),
      loras: loras.map((item: any) => ({ name: String(item.name), alias: String(item.alias ?? item.name) })),
      vaes: vaes.map((item: any) => String(item.model_name ?? item.filename ?? item.name)).filter(Boolean),
      scripts: {
        txt2img: Array.isArray(scripts.txt2img) ? scripts.txt2img.map(String) : [],
        img2img: Array.isArray(scripts.img2img) ? scripts.img2img.map(String) : []
      },
      upscalers: upscalers.map((item: any) => String(item.name)).filter(Boolean),
      embeddings: Object.keys(embeddings.loaded ?? {})
    };
    this.cachedCapabilities = { expiresAt: Date.now() + 15_000, value };
    return value;
  }

  async prepareParams(input: SdParams): Promise<SdParams> {
    const params: SdParams = {
      ...DEFAULT_SD_PARAMS,
      ...input,
      width: this.normalizeDimension(input.width),
      height: this.normalizeDimension(input.height),
      steps: Math.min(80, Math.max(1, Math.round(input.steps))),
      cfgScale: Math.min(20, Math.max(1, input.cfgScale)),
      samplerName: input.samplerName.replace(/\s+Karras$/i, ''),
      loras: input.loras ?? [],
      scriptArgs: input.scriptArgs ?? []
    };
    if (!this.configured) return params;
    try {
      const available = await this.capabilities();
      params.samplerName = this.matchName(params.samplerName, available.samplers) ?? available.samplers[0] ?? 'Euler a';
      params.schedulerName = params.schedulerName ? this.matchName(params.schedulerName, available.schedulers) : null;
      const model = params.modelCheckpoint ? available.models.find((item) => [item.title, item.modelName, item.hash].some((value) => value?.toLowerCase() === params.modelCheckpoint!.toLowerCase())) : null;
      params.modelCheckpoint = model?.title ?? null;
      params.vaeName = params.vaeName ? this.matchName(params.vaeName, available.vaes) : null;
      params.loras = params.loras.flatMap((requested) => {
        const found = available.loras.find((item) => item.name.toLowerCase() === requested.name.toLowerCase() || item.alias.toLowerCase() === requested.name.toLowerCase());
        return found ? [{ name: found.name, weight: Math.min(2, Math.max(-2, requested.weight)) }] : [];
      });
      const allowedScripts = params.mode === 'txt2img' ? available.scripts.txt2img : available.scripts.img2img;
      params.scriptName = params.scriptName ? this.matchName(params.scriptName, allowedScripts) : null;
      if (!params.scriptName) params.scriptArgs = [];
    } catch {
      // Keep locally normalized parameters when the remote capability inventory is temporarily unavailable.
    }
    return params;
  }

  async generate(input: SdParams): Promise<string[]> {
    if (!this.configured) throw new ServiceUnavailableException('Stable Diffusion 尚未配置');
    const params = await this.prepareParams(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.SD_TIMEOUT_MS ?? 120_000));
    try {
      const samplerName = params.samplerName.replace(/\s+Karras$/i, '');
      const loraTags = params.loras.map((lora) => `<lora:${lora.name}:${lora.weight}>`).join(' ');
      const overrideSettings = {
        ...(params.modelCheckpoint ? { sd_model_checkpoint: params.modelCheckpoint } : {}),
        ...(params.vaeName ? { sd_vae: params.vaeName } : {})
      };
      const basePayload = {
        prompt: [params.prompt, loraTags].filter(Boolean).join(' '), negative_prompt: params.negativePrompt,
        sampler_name: samplerName, ...(params.schedulerName ? { scheduler: params.schedulerName } : {}),
        steps: params.steps, width: params.width, height: params.height, cfg_scale: params.cfgScale, seed: params.seed,
        batch_size: 1, n_iter: 1,
        ...(Object.keys(overrideSettings).length ? { override_settings: overrideSettings, override_settings_restore_afterwards: true } : {}),
        ...(params.scriptName ? { script_name: params.scriptName, script_args: params.scriptArgs } : {})
      };
      let endpoint = '/sdapi/v1/txt2img';
      let requestPayload: Record<string, unknown> = basePayload;
      if (params.mode !== 'txt2img') {
        if (!params.initImageUrl) throw new ServiceUnavailableException('图生图需要原图');
        endpoint = '/sdapi/v1/img2img';
        requestPayload = {
          ...basePayload,
          init_images: [await this.images.toVisionSource(params.initImageUrl)],
          denoising_strength: params.denoisingStrength,
          resize_mode: 0,
          ...(params.mode === 'inpaint' ? {
            mask: params.maskImageUrl ? await this.images.toVisionSource(params.maskImageUrl) : undefined,
            mask_blur: params.maskBlur,
            inpainting_fill: 1,
            inpaint_full_res: true
          } : {})
        };
      }
      let response = await fetch(this.url(endpoint), {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 404 && /sampler not found/i.test(detail)) {
          requestPayload = { ...requestPayload, sampler_name: 'Euler a' };
          response = await fetch(this.url(endpoint), {
            method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
          });
        } else {
          throw new ServiceUnavailableException(this.responseError(response, detail));
        }
      }
      if (!response.ok) {
        const detail = await response.text();
        throw new ServiceUnavailableException(this.responseError(response, detail));
      }
      const payload = await response.json() as { images?: string[] };
      if (!payload.images?.length) throw new ServiceUnavailableException('A1111 没有返回图像');
      return Promise.all(payload.images.map((image) => this.images.saveBase64(image)));
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if ((error as Error).name === 'AbortError') throw new ServiceUnavailableException('图像生成超时');
      const message = error instanceof Error ? error.message : String(error);
      throw new ServiceUnavailableException(`Stable Diffusion 暂时不可用：${message}`);
    } finally { clearTimeout(timer); }
  }

  txt2img(params: SdParams) { return this.generate(params); }

  async interrupt() {
    if (this.configured) await fetch(this.url('/sdapi/v1/interrupt'), { method: 'POST' }).catch(() => undefined);
  }

  private async getArray(path: string): Promise<any[]> {
    const payload = await this.getJson(path);
    if (!Array.isArray(payload)) throw new ServiceUnavailableException('A1111 能力响应格式不正确');
    return payload;
  }

  private async getJson(path: string): Promise<any> {
    const response = await fetch(this.url(path), { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(this.responseError(response, detail));
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new ServiceUnavailableException('Stable Diffusion 地址没有指向 A1111 API');
    }
    const payload = await response.json();
    return payload;
  }

  private normalizeDimension(value: number) {
    return Math.min(1536, Math.max(256, Math.round(value / 64) * 64));
  }

  private responseError(response: Response, detail: string) {
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (response.status === 404 && (contentType.includes('text/html') || /autodl|seetacloud|查看faq文档/i.test(detail))) {
      return 'A1111 公网端口映射已失效或未指向 SD WebUI。请在云平台重新启用容器 6006 端口映射，并更新 SD_BASE_URL。';
    }
    return `A1111 请求失败 (${response.status})${detail ? `：${detail.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)}` : ''}`;
  }

  private matchName(requested: string, available: string[]) {
    const normalized = requested.trim().toLowerCase();
    return available.find((item) => item.toLowerCase() === normalized)
      ?? available.find((item) => item.toLowerCase() === normalized.replace(/\s+karras$/i, ''))
      ?? null;
  }

  private url(path: string) { return `${process.env.SD_BASE_URL!.replace(/\/$/, '')}${path}`; }

}
