import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ApiClient authentication recovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('clears stale credentials and announces an expired session', async () => {
    const values = new Map<string, string>([
      ['wisadel.accessToken', 'stale-access'],
      ['wisadel.refreshToken', 'stale-refresh'],
      ['wisadel.user', '{"id":"stale-user"}']
    ]);
    const removeItem = vi.fn((key: string) => values.delete(key));
    const dispatchEvent = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem
    });
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })));
    const { ApiClient, AUTH_EXPIRED_EVENT } = await import('./api');

    await expect(new ApiClient().sessions('chat')).rejects.toThrow('unauthorized');

    expect(values.has('wisadel.accessToken')).toBe(false);
    expect(values.has('wisadel.refreshToken')).toBe(false);
    expect(values.has('wisadel.user')).toBe(false);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({ type: AUTH_EXPIRED_EVENT });
  });
});
