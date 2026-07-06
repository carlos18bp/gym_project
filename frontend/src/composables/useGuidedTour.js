import { ref, nextTick } from 'vue'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/shared/tours/tour.css'
import { get_request, create_request } from '@/stores/services/request_http'
import { showTourOfferAlert } from '@/shared/tours/tour_offer_alert'
import { fireTourConfetti } from '@/shared/tours/confetti'
import { getTourConfig } from '@/shared/tours'

export const AUTO_START_DELAY_MS = 500

const VALID_STATUSES = ['never', 'recent', 'stale']

const CARD_CLASS = 'gyj-tour-popover gyj-tour-popover--card'

// Inline heroicons (outline, 24px) for the framing cards. Raw SVG because
// the popover DOM is managed by driver.js outside the Vue tree.
const WELCOME_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9.36 17.35a.75.75 0 01-1.42 0l-.453-1.446a3.75 3.75 0 00-2.481-2.481L3.56 12.97a.75.75 0 010-1.42l1.446-.453a3.75 3.75 0 002.481-2.481L7.94 7.17a.75.75 0 011.42 0l.453 1.446a3.75 3.75 0 002.481 2.481l1.446.453a.75.75 0 010 1.42l-1.446.453a3.75 3.75 0 00-2.481 2.481zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg>'

const FINALE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"/></svg>'

/**
 * Composable for the guided product tour (driver.js) of a module.
 *
 * Provides:
 * - Tour status from the backend (never | recent | stale)
 * - Auto-start on first visit, confirmation re-offer after 30 days
 * - Manual launch (help button) and completion tracking
 *
 * @param {object} options
 * @param {string} options.module - backend module identifier, e.g. 'dynamic_documents'
 * @param {Function} options.getRole - returns the current user role
 * @param {Function} options.setActiveTab - switches the dashboard tab (injected by the view)
 * @param {Function} [options.getContext] - returns runtime flags for conditional steps
 */
export function useGuidedTour({ module, getRole, setActiveTab, getContext }) {
  // State
  const tourStatus = ref(null)
  const isTourActive = ref(false)

  let driverObj = null
  let activeSteps = []
  let completedThisRun = false

  /**
   * Fetch the tour status for this module from the backend.
   * Unknown or empty responses resolve to null, which disables any
   * automatic behavior (fail-safe for mocked/legacy environments).
   */
  async function fetchTourStatus() {
    try {
      const response = await get_request(`tour-progress/?module=${module}`)
      const status = response.data?.status
      tourStatus.value = VALID_STATUSES.includes(status) ? status : null
    } catch (err) {
      console.error('Failed to fetch tour status:', err)
      tourStatus.value = null
    }
  }

  /**
   * Mark the tour as completed (finished, skipped or declined) in the
   * backend, resetting the 30-day re-offer clock.
   */
  async function markCompleted() {
    try {
      const response = await create_request('tour-progress/complete/', {
        module_name: module,
      })
      tourStatus.value = response.data?.status || 'recent'
    } catch (err) {
      console.error('Failed to mark tour as completed:', err)
    }
  }

  /**
   * Return the first *visible* element matching the selector.  Desktop
   * and mobile variants share the same data-tour value, so visibility
   * decides which node the spotlight targets.
   */
  function resolveVisibleTarget(selector) {
    const nodes = document.querySelectorAll(selector)
    for (const node of nodes) {
      if (node.offsetParent !== null) return node
    }
    return null
  }

  function isDesktopViewport() {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)').matches
      : true
  }

  /**
   * Build the driver.js step list for the current role/viewport.
   *
   * Content steps: filtered exactly as before (desktopOnly below md,
   * targets not visible right now unless tab metadata will render them),
   * then decorated with a literal "Paso N de T" computed over content
   * steps only — the framing cards must never shift the mandated counts.
   * driver.js quirk: a per-step showProgress:false cannot override a
   * global true (they are OR'ed), so the global flag stays false and
   * content steps opt IN per step.
   *
   * Framing: an optional element-less welcome card is prepended and an
   * optional finale (highlighting the help button) is appended. With
   * zero content steps the tour does not run at all (fail-safe intact).
   */
  function buildSteps() {
    const config = getTourConfig(module)
    if (!config) return []

    const context = typeof getContext === 'function' ? getContext() : {}
    const isDesktop = isDesktopViewport()

    const contentSteps = config
      .getSteps(getRole(), context)
      .filter((step) => !(step.desktopOnly && !isDesktop))
      .filter((step) => step.tab || resolveVisibleTarget(step.target))

    if (!contentSteps.length) return []

    const total = contentSteps.length
    const steps = contentSteps.map((step, i) => ({
      element: () => resolveVisibleTarget(step.target),
      popover: {
        ...step.popover,
        showProgress: true,
        progressText: `Paso ${i + 1} de ${total}`,
      },
      tab: step.tab || null,
      data: { kind: 'content', index: i + 1, total },
    }))

    if (config.intro) {
      steps.unshift({
        // No `element` key: driver.js renders a centered modal-style card
        popover: {
          ...config.intro.popover,
          showButtons: ['next', 'close'],
          popoverClass: CARD_CLASS,
        },
        tab: config.intro.tab || null,
        data: { kind: 'welcome' },
      })
    }

    if (config.finale && resolveVisibleTarget(config.finale.target)) {
      steps.push({
        element: () => resolveVisibleTarget(config.finale.target),
        popover: {
          ...config.finale.popover,
          popoverClass: `${CARD_CLASS} gyj-tour-popover--finale`,
        },
        tab: config.finale.tab || null,
        data: { kind: 'finale' },
      })
    }

    return steps
  }

  /**
   * Switch to the tab required by the destination step (if any) and wait
   * for the DOM to settle before letting driver.js move the spotlight.
   */
  async function moveToStep(targetIndex, moveFn) {
    const step = activeSteps[targetIndex]
    if (step && step.tab) {
      setActiveTab(step.tab)
      await nextTick()
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
    }
    moveFn()
  }

  function handleNextClick() {
    if (!driverObj) return
    moveToStep(driverObj.getActiveIndex() + 1, () => driverObj.moveNext())
  }

  function handlePrevClick() {
    if (!driverObj) return
    moveToStep(driverObj.getActiveIndex() - 1, () => driverObj.movePrevious())
  }

  /**
   * Register the completion POST at most once per tour run.  Called from
   * every exit path (skip, close, overlay, done) — driver.js only fires
   * onDestroyed after the first highlight transition settles, so the
   * explicit exit handlers must not rely on it alone.
   */
  function completeOnce() {
    if (completedThisRun) return
    completedThisRun = true
    markCompleted()
  }

  function dismissTour() {
    completeOnce()
    if (driverObj) driverObj.destroy()
  }

  /**
   * True end of the tour ("Entendido" on the closing card, mouse or
   * ArrowRight — driver.js dispatches onDoneClick instead of onNextClick
   * on the last step). The only path that celebrates: skip/close/overlay
   * routes never fire confetti.
   */
  function handleDoneClick() {
    completeOnce()
    if (driverObj) driverObj.destroy()
    fireTourConfetti()
  }

  /**
   * Single global popover decorator (per-step onPopoverRender hooks would
   * override it, so everything renders here based on the step's kind).
   * driver.js sets state.activeStep before calling this hook.
   */
  function decoratePopover(popover, opts = {}) {
    const config = getTourConfig(module)
    const data = opts.state?.activeStep?.data || { kind: 'content' }

    // 1. Eyebrow context label above the title (textContent: XSS-safe
    //    even if a future module config ever carried dynamic text)
    if (config?.eyebrow && popover.title) {
      const eyebrow = document.createElement('span')
      eyebrow.className = 'gyj-tour-eyebrow'
      eyebrow.textContent = config.eyebrow
      popover.title.insertAdjacentElement('beforebegin', eyebrow)
    }

    // 2. Circular icon on framing cards (innerHTML is safe here: the SVG
    //    markup comes from the static module-level constants above)
    if ((data.kind === 'welcome' || data.kind === 'finale') && popover.wrapper) {
      const icon = document.createElement('span')
      icon.className = 'gyj-tour-card-icon'
      icon.setAttribute('aria-hidden', 'true')
      icon.innerHTML = data.kind === 'welcome' ? WELCOME_ICON_SVG : FINALE_ICON_SVG
      popover.wrapper.insertBefore(icon, popover.wrapper.firstChild)
    }

    // 3. Animated progress bar (content steps only)
    if (data.kind === 'content' && data.total && popover.footer) {
      const track = document.createElement('div')
      track.className = 'gyj-tour-progress-track'
      const fill = document.createElement('div')
      fill.className = 'gyj-tour-progress-fill'
      fill.style.width = `${((data.index - 1) / data.total) * 100}%`
      track.appendChild(fill)
      popover.footer.insertAdjacentElement('beforebegin', track)
      window.requestAnimationFrame(() => {
        fill.style.width = `${(data.index / data.total) * 100}%`
      })
    }

    // 4. Keyboard hint (welcome card, desktop only)
    if (data.kind === 'welcome' && isDesktopViewport() && popover.footer) {
      const hint = document.createElement('div')
      hint.className = 'gyj-tour-kbd-hint'
      for (const key of ['←', '→']) {
        const kbd = document.createElement('kbd')
        kbd.textContent = key
        hint.appendChild(kbd)
      }
      hint.appendChild(document.createTextNode(' para moverte por la guía'))
      popover.footer.insertAdjacentElement('beforebegin', hint)
    }

    // 5. Skip button: "Ahora no" on the welcome card, "Omitir guía" on
    //    content steps, none on the finale (redundant next to "Entendido")
    if (data.kind !== 'finale' && popover.footerButtons) {
      const skipButton = document.createElement('button')
      skipButton.innerText = data.kind === 'welcome' ? 'Ahora no' : 'Omitir guía'
      skipButton.className = 'gyj-tour-skip-btn'
      skipButton.addEventListener('click', dismissTour)
      popover.footerButtons.appendChild(skipButton)
    }
  }

  /**
   * Backstop for exits driver.js initiates itself (overlay click, Escape);
   * completeOnce() keeps completion single-shot across all paths.
   */
  function handleDestroyed() {
    isTourActive.value = false
    driverObj = null
    completeOnce()
  }

  /**
   * Start the tour from the first step (auto-trigger or help button).
   */
  async function startTour() {
    if (isTourActive.value) return
    activeSteps = buildSteps()
    if (!activeSteps.length) return

    completedThisRun = false
    driverObj = driver({
      showProgress: false, // content steps opt in per step (see buildSteps)
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      allowClose: true,
      overlayColor: '#141E30',
      overlayOpacity: 0.7,
      smoothScroll: true,
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: 'gyj-tour-popover',
      steps: activeSteps,
      onNextClick: handleNextClick,
      onPrevClick: handlePrevClick,
      onCloseClick: dismissTour,
      onDoneClick: handleDoneClick,
      onPopoverRender: decoratePopover,
      onDestroyed: handleDestroyed,
    })
    isTourActive.value = true

    if (activeSteps[0].tab) {
      setActiveTab(activeSteps[0].tab)
      await nextTick()
    }
    driverObj.drive()
  }

  /**
   * Decide what to do after page load:
   * - 'never'  → auto-start after a short delay so first paint settles
   * - 'stale'  → offer the tour again via the branded modal; declining
   *              also marks completion so the offer waits another cycle
   * - 'recent' / unknown → do nothing
   */
  async function maybeAutoStartTour() {
    await fetchTourStatus()

    if (tourStatus.value === 'never') {
      window.setTimeout(() => {
        startTour()
      }, AUTO_START_DELAY_MS)
    } else if (tourStatus.value === 'stale') {
      const config = getTourConfig(module)
      const message = config?.confirmMessage || '¿Quieres ver la guía del módulo?'
      const confirmed = await showTourOfferAlert(message)
      if (confirmed) {
        startTour()
      } else {
        markCompleted()
      }
    }
  }

  return {
    // State
    tourStatus,
    isTourActive,

    // Methods
    fetchTourStatus,
    startTour,
    maybeAutoStartTour,
    markCompleted,
  }
}
