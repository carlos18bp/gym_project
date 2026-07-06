import { ref, nextTick } from 'vue'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/shared/tours/tour.css'
import { get_request, create_request } from '@/stores/services/request_http'
import { showConfirmationAlert } from '@/shared/confirmation_alert'
import { getTourConfig } from '@/shared/tours'

export const AUTO_START_DELAY_MS = 500

const VALID_STATUSES = ['never', 'recent', 'stale']

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

  /**
   * Build the driver.js step list for the current role/viewport:
   * - desktopOnly steps are dropped below the md breakpoint
   * - steps without tab metadata are dropped when their target is not
   *   visible in the DOM right now
   * - steps with tab metadata are kept (their target renders after the
   *   composable switches to that tab)
   */
  function buildSteps() {
    const config = getTourConfig(module)
    if (!config) return []

    const context = typeof getContext === 'function' ? getContext() : {}
    const isDesktop =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(min-width: 768px)').matches
        : true

    return config
      .getSteps(getRole(), context)
      .filter((step) => !(step.desktopOnly && !isDesktop))
      .filter((step) => step.tab || resolveVisibleTarget(step.target))
      .map((step) => ({
        element: () => resolveVisibleTarget(step.target),
        popover: step.popover,
        tab: step.tab || null,
      }))
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
   * driver.js has no built-in labeled skip control, so a text button is
   * appended to every popover footer.  Skipping destroys the tour, which
   * routes through onDestroyed and marks it completed.
   */
  function renderSkipButton(popover) {
    const skipButton = document.createElement('button')
    skipButton.innerText = 'Omitir guía'
    skipButton.className = 'gyj-tour-skip-btn'
    skipButton.addEventListener('click', () => {
      if (driverObj) driverObj.destroy()
    })
    popover.footerButtons.appendChild(skipButton)
  }

  /**
   * Fires on both "Finalizar" and any skip/close path, so completion is
   * registered exactly once per run regardless of how the tour ended.
   */
  function handleDestroyed() {
    isTourActive.value = false
    driverObj = null
    if (!completedThisRun) {
      completedThisRun = true
      markCompleted()
    }
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
      showProgress: true,
      progressText: 'Paso {{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      allowClose: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      popoverClass: 'gyj-tour-popover',
      steps: activeSteps,
      onNextClick: handleNextClick,
      onPrevClick: handlePrevClick,
      onPopoverRender: renderSkipButton,
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
   * - 'stale'  → offer the tour again via confirmation modal; declining
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
      const confirmed = await showConfirmationAlert(message)
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
