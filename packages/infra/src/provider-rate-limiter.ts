/**
 * Provider-specific Request Rate Limiter (Token Bucket / Minimum Inter-Request Delay)
 * Prevents bursting requests that trigger 429 Too Many Requests on search providers (e.g. Brave 1 RPS).
 */
export class ProviderRateLimiter {
  private static providerDelays: Record<string, number> = {
    brave: 1050,      // Brave Search Free Tier: strictly 1 RPS (1050ms spacing)
    wikimedia: 350,   // Wikimedia Commons: max ~3 RPS (350ms spacing)
    gallica: 500,     // Gallica BnF: max ~2 RPS (500ms spacing)
    tavily: 200,      // Tavily: max 5 RPS (200ms spacing)
    serpapi: 500,     // SerpApi: max 2 RPS (500ms spacing)
  };

  private static lastRequestTimes: Map<string, number> = new Map();
  private static providerChains: Map<string, Promise<void>> = new Map();

  public static async acquireSlot(provider: string): Promise<void> {
    const key = provider.toLowerCase();
    const delay = this.providerDelays[key];
    if (!delay) return;

    // Chaining promise pattern guarantees strict FIFO execution without race conditions
    const previous = this.providerChains.get(key) || Promise.resolve();

    let releaseCurrent: () => void = () => {};
    const currentPromise = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    // Register current as the new tail synchronously before yielding execution
    this.providerChains.set(key, currentPromise);

    try {
      // Await predecessor in queue; catch errors from preceding requests to prevent deadlock cascade
      await previous.catch(() => {});

      const now = Date.now();
      const last = this.lastRequestTimes.get(key) || 0;
      const elapsed = now - last;
      if (elapsed < delay) {
        const waitMs = delay - elapsed;
        await new Promise((r) => setTimeout(r, waitMs));
      }
      this.lastRequestTimes.set(key, Date.now());
    } finally {
      releaseCurrent();
      if (this.providerChains.get(key) === currentPromise) {
        this.providerChains.delete(key);
      }
    }
  }
}
