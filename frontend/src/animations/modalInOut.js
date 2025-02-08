import { gsap } from 'gsap';

/**
 * Handles the fade-in animation for a modal.
 * - The element starts with 0 opacity and fades to full visibility.
 * - The animation lasts 0.5 seconds and uses the 'power2.out' easing function.
 *
 * @param {HTMLElement} el - The HTML element to apply the animation to.
 */
export function fadeInModal(el) {
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
}

/**
 * Handles the fade-out animation for a modal.
 * - The element fades from full visibility to 0 opacity.
 * - The animation lasts 0.4 seconds and uses the 'power2.in' easing function.
 * - Calls the `onComplete` callback once the animation finishes.
 *
 * @param {HTMLElement} el - The HTML element to apply the animation to.
 * @param {Function} onComplete - Callback function to be executed after the animation completes.
 */
export function fadeOutModal(el, onComplete) {
  gsap.to(el, { opacity: 0, duration: 0.4, ease: 'power2.in', onComplete });
}
