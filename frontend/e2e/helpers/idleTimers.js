/**
 * Control over the long-lived native `setTimeout` timers the application arms.
 *
 * ── Why this exists instead of `page.clock` ──────────────────────────────────
 * `page.clock.install()` in @playwright/test 1.60 takes exactly one option,
 * `{ time }` (see the `Clock` interface in playwright-core/types/types.d.ts):
 * there is no `toFake` allow-list, so it *always* replaces
 * `requestAnimationFrame`/`cancelAnimationFrame` together with
 * `setTimeout`/`setInterval`. Its fake timer registry then rejects every
 * cross-family clear — `clearTimer()` tolerates only Timeout<->Interval and
 * otherwise throws:
 *
 *   Error: clock.fastForward: Error: Cannot clear timer: timer created with
 *   requestAnimationFrame() but cleared with clearInterval()
 *
 * One of the rAF-driven libraries loaded on the dashboard (gsap, swiper,
 * flowbite, sweetalert2, headlessui, tinymce) does
 * exactly that, so `fastForward()` throws before advancing a single
 * millisecond and no application timer ever fires. The failure is
 * deterministic, not flaky.
 *
 * ── What we do instead ──────────────────────────────────────────────────────
 * No time is faked at all. We wrap the *native* timer functions, remember the
 * long timers the application itself arms, and let a test re-arm those same
 * callbacks to fire sooner. `requestAnimationFrame` is never touched, and the
 * function that eventually runs is the production callback, invoked by the
 * browser's own event loop rather than by the test.
 */

// Only timers at or above this delay are tracked. The app's other long timer
// (SyncStatus.vue, 3 min) stays below the floor, so nothing but a genuine
// idle-logout style timer is ever re-armed.
const DEFAULT_MIN_DELAY_MS = 10 * 60 * 1000;

/**
 * Wraps `window.setTimeout` / `window.clearTimeout` before the SPA boots.
 *
 * Must be called before the first `page.goto`: the wrapper can only record a
 * timer that is armed after it is installed.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ minDelayMs?: number }} [options]
 */
export async function installLongTimerControl(page, { minDelayMs = DEFAULT_MIN_DELAY_MS } = {}) {
  await page.addInitScript((minDelay) => {
    const nativeSetTimeout = window.setTimeout;
    const nativeClearTimeout = window.clearTimeout;

    // id -> the production callback and its extra setTimeout arguments.
    const pending = new Map();

    window.setTimeout = function (handler, delay, ...args) {
      const id = nativeSetTimeout.call(window, handler, delay, ...args);
      if (typeof handler === "function" && Number(delay) >= minDelay) {
        pending.set(id, { handler, args });
      }
      return id;
    };

    window.clearTimeout = function (id) {
      // Keep the registry in step with the app: a timer the app cancelled (any
      // activity event makes useIdleLogout re-arm) must not be re-armed later.
      pending.delete(id);
      return nativeClearTimeout.call(window, id);
    };

    window.__e2eLongTimers = {
      minDelayMs: minDelay,
      armedCount: () => pending.size,
      /**
       * Re-schedules every currently armed long timer to fire after `fireInMs`.
       * Returns how many were re-armed — 0 means the app never armed one.
       */
      accelerate: (fireInMs) => {
        const armed = [...pending.values()];
        for (const id of [...pending.keys()]) {
          nativeClearTimeout.call(window, id);
          pending.delete(id);
        }
        for (const timer of armed) {
          nativeSetTimeout.call(window, timer.handler, fireInMs, ...timer.args);
        }
        return armed.length;
      },
    };
  }, minDelayMs);
}

/**
 * Makes the app's pending long timers fire almost immediately.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ fireInMs?: number }} [options]
 * @returns {Promise<number>} how many timers were re-armed
 */
export async function accelerateLongTimers(page, { fireInMs = 500 } = {}) {
  return page.evaluate((ms) => window.__e2eLongTimers.accelerate(ms), fireInMs);
}
