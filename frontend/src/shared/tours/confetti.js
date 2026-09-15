import confetti from 'canvas-confetti'

// Brand-tinted palette: navy, electric blue, white, slate.
export const TOUR_CONFETTI_COLORS = ['#141E30', '#3348FF', '#FFFFFF', '#94A3B8']

/**
 * Brief brand-tinted celebration when the user reaches the END of a tour
 * (never on skip/close). No-op under prefers-reduced-motion and never
 * throws — the completion POST has already been sent by then.
 */
export function fireTourConfetti() {
  try {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const base = {
      colors: TOUR_CONFETTI_COLORS,
      disableForReducedMotion: true,
      ticks: 200,
      gravity: 1.1,
      startVelocity: 42,
      spread: 70,
      zIndex: 10050,
    }

    confetti({ ...base, particleCount: 60, angle: 60, origin: { x: 0.15, y: 0.9 } })
    confetti({ ...base, particleCount: 60, angle: 120, origin: { x: 0.85, y: 0.9 } })
    window.setTimeout(() => {
      try {
        confetti({ ...base, particleCount: 40, spread: 100, origin: { x: 0.5, y: 0.7 } })
      } catch (err) {
        console.error('Tour confetti failed:', err)
      }
    }, 250)
  } catch (err) {
    console.error('Tour confetti failed:', err)
  }
}
