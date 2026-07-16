import { describe, expect, it } from 'vitest';
import { DEFAULT_SD_PARAMS, imageAgentActionSchema, sdParamsSchema } from './index.js';

describe('shared contracts', () => {
  it('provides valid stable diffusion defaults', () => {
    expect(sdParamsSchema.parse(DEFAULT_SD_PARAMS)).toEqual(DEFAULT_SD_PARAMS);
  });

  it('rejects unsafe image dimensions', () => {
    expect(() => sdParamsSchema.parse({ width: 9999 })).toThrow();
  });

  it('accepts a partial parameter update from the image agent', () => {
    const result = imageAgentActionSchema.parse({
      reply: '已调整为横向构图，请确认。',
      action: 'update_params',
      params: { width: 1024, height: 576 },
      requiresConfirmation: true
    });
    expect(result.params.width).toBe(1024);
  });

  it('supports structured SD component selection', () => {
    const result = sdParamsSchema.parse({
      modelCheckpoint: 'anime-model.safetensors',
      schedulerName: 'Karras',
      loras: [{ name: 'detail-lora', weight: 0.75 }],
      scriptName: 'Hypertile',
      scriptArgs: [true, 256]
    });
    expect(result.loras[0]).toEqual({ name: 'detail-lora', weight: 0.75 });
    expect(result.scriptArgs).toEqual([true, 256]);
  });
});
