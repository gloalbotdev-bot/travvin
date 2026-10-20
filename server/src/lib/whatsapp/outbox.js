/**
 * Process-wide outbound queue: sends one message at a time with a minimum gap, and pauses all
 * sending when the provider reports a plan / rate limit — so a burst (cron, many bot replies)
 * can't burn a small quota or trip provider rate limits. Provider-agnostic.
 */

const DEFAULT_MIN_INTERVAL_MS = 1000;
const DEFAULT_LIMIT_PAUSE_MS = 15 * 60 * 1000;

/**
 * @param {{ minIntervalMs?: number, limitPauseMs?: number, now?: () => number, sleep?: (ms: number) => Promise<void> }} [opts]
 */
export function createOutbox({
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  limitPauseMs = DEFAULT_LIMIT_PAUSE_MS,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  let tail = Promise.resolve();
  let lastSendAt = -Infinity;
  let pausedUntil = 0;
  const stats = { sent: 0, failed: 0, skipped: 0, limited: 0, queued: 0, lastError: '' };

  /**
   * Run one send through the queue.
   * @param {() => Promise<import('./contract.js').SendResult>} task
   * @returns {Promise<import('./contract.js').SendResult>}
   */
  function run(task) {
    stats.queued += 1;
    const result = tail.then(async () => {
      stats.queued -= 1;
      if (now() < pausedUntil) {
        stats.limited += 1;
        return {
          ok: false,
          status: 'failed',
          limitReached: true,
          error: `WhatsApp sending paused (plan/rate limit) until ${new Date(pausedUntil).toISOString()}`,
        };
      }
      const wait = lastSendAt + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      lastSendAt = now();

      /** @type {import('./contract.js').SendResult} */
      let r;
      try {
        r = await task();
      } catch (e) {
        r = { ok: false, status: 'failed', error: e instanceof Error ? e.message : String(e) };
      }
      if (r.ok) stats.sent += 1;
      else if (r.status === 'failed') stats.failed += 1;
      else stats.skipped += 1;
      if (r.error) stats.lastError = r.error;
      if (r.limitReached) {
        pausedUntil = now() + limitPauseMs;
        console.warn(
          `[whatsapp] provider limit reached — pausing sends until ${new Date(pausedUntil).toISOString()}`,
        );
      }
      return r;
    });
    // Keep the chain alive regardless of this task's outcome.
    tail = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    run,
    stats: () => ({
      ...stats,
      pausedUntil: pausedUntil > now() ? new Date(pausedUntil).toISOString() : null,
    }),
  };
}

let shared = null;

/** The process-wide outbox (gap configurable with WHATSAPP_MIN_SEND_INTERVAL_MS). */
export function getOutbox() {
  if (!shared) {
    const gap = Number(process.env.WHATSAPP_MIN_SEND_INTERVAL_MS);
    shared = createOutbox(Number.isFinite(gap) && gap >= 0 ? { minIntervalMs: gap } : {});
  }
  return shared;
}
