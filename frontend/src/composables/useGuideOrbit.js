import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue';

export function orbitalPosition(index, total, angle, zoom) {
  const radians = ((360 * index / Math.max(total, 1)) + angle - 90) * Math.PI / 180;
  return { left: `${50 + Math.cos(radians) * 36 * zoom}%`, top: `${50 + Math.sin(radians) * 37 * zoom}%` };
}

// Adapted from Project Apps' useOrbitalExplorer. Motion stays local to the guide.
export function useGuideOrbit(container, externallyPaused) {
  const angle = ref(0);
  const zoom = ref(1);
  const compact = ref(true);
  const paused = ref(false);
  const reducedMotion = ref(false);
  const hovering = ref(false);
  const focused = ref(false);
  const dragging = ref(false);
  const visible = ref(true);
  const moving = computed(() => ![compact.value, paused.value, reducedMotion.value,
    hovering.value, focused.value, dragging.value, !visible.value, unref(externallyPaused)].some(Boolean));
  let frame;
  let previousTime;
  let observer;
  let media;
  let startX = 0;
  let previousX = 0;
  let dragged = false;

  const rotate = amount => { angle.value = (angle.value + amount + 360) % 360; };
  const resize = () => { compact.value = container.value.getBoundingClientRect().width < 1024; };
  const motionChanged = event => { reducedMotion.value = event.matches; };
  const visibilityChanged = () => { visible.value = document.visibilityState !== 'hidden'; };
  function animate(timestamp) {
    const elapsed = previousTime === undefined ? 0 : Math.min((timestamp - previousTime) / 1000, 0.1);
    previousTime = timestamp;
    rotate(elapsed * 2.4);
    frame = window.requestAnimationFrame(animate);
  }
  // Do not run an idle animation loop in compact/reduced-motion/hidden states.
  const stop = () => {
    window.cancelAnimationFrame(frame);
    frame = null;
    previousTime = undefined;
  };
  watch(moving, active => {
    if (active && frame == null) frame = window.requestAnimationFrame(animate);
    else if (!active) stop();
  });
  function zoomBy(amount) { zoom.value = Math.max(0.82, Math.min(1.07, zoom.value + amount)); }
  function reset() { angle.value = 0; zoom.value = 1; }
  function startDrag(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX = previousX = event.clientX;
    dragged = false;
    dragging.value = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (!dragging.value) return;
    if (Math.abs(event.clientX - startX) > 4) dragged = true;
    rotate((event.clientX - previousX) * 0.35);
    previousX = event.clientX;
  }
  function endDrag(event) {
    if (!dragging.value) return;
    dragging.value = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }
  function consumeDrag() { const result = dragged; dragged = false; return result; }

  onMounted(() => {
    resize();
    observer = new ResizeObserver(resize);
    observer.observe(container.value);
    window.addEventListener('resize', resize);
    media = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionChanged(media);
    visibilityChanged();
    media.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
  });
  onBeforeUnmount(() => {
    stop();
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    media?.removeEventListener('change', motionChanged);
    document.removeEventListener('visibilitychange', visibilityChanged);
  });

  return { angle, zoom, compact, paused, reducedMotion, hovering, focused, moving,
    rotate, zoomBy, reset, startDrag, moveDrag, endDrag, consumeDrag };
}
