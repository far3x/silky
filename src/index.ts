/**
 * silky: smooth wheel scrolling for pages that scroll inside their own containers.
 *
 * One window wheel listener finds the scroller under the pointer (nested scrollers chain like
 * native scrolling) and glides it toward a target with frame-rate independent easing. Built to
 * cost as little main-thread time as possible:
 *
 * - one shared frame loop that runs only while something glides, and stops on a hidden page
 *   (a pending frame is never left dangling, so scrolling cannot stall after a window switch);
 * - per frame: one read and one write of scrollTop per gliding scroller, nothing else: no class
 *   toggles (which restyle the whole subtree), no computed-style reads;
 * - computed styles (overflow, overscroll-behavior) are cached per element;
 * - content changes are followed, not fought: when the page moves a gliding scroller itself
 *   (live rows inserted above, scroll anchoring, keyboard), the glide shifts by the same amount.
 *
 * Touch, horizontal wheels, ctrl+wheel (zoom) and wheels another handler already consumed stay
 * native. Opt an element (and its subtree) out with `data-silky-prevent`.
 */

export interface SilkyOptions {
  /** Time constant of the glide in milliseconds: higher is smoother and longer. Default 167, the
   * glide of Lenis' default (lerp 0.1 at 60 Hz = a 6/s exponential decay). */
  smoothness?: number;
  /** Multiplier applied to wheel deltas. Default 1. */
  wheelMultiplier?: number;
  /** Extra attribute names that opt an element out, besides `data-silky-prevent`. */
  preventAttributes?: string[];
  /** Ancestor selector whose scrollers manage themselves (another smooth scroller). */
  ownSelector?: string;
  /** Keep native scrolling when the user prefers reduced motion. Default false. */
  respectReducedMotion?: boolean;
}

export interface Silky {
  /** Glides (or jumps, with `immediate`) an element's scroll position to `top`. */
  scrollTo(element: Element, top: number, options?: { immediate?: boolean }): void;
  /** True while any scroller glides. */
  readonly scrolling: boolean;
  /** Removes the listeners and finishes every glide at its target. */
  destroy(): void;
}

interface Glide {
  element: Element;
  /** Fractional position of the glide. */
  position: number;
  target: number;
  /** scrollTop read back after silky's last write (the browser rounds fractional offsets). */
  written: number;
}

interface StyleInfo { scrolls: boolean; contained: boolean }

const MAX_STEP_MS = 50;
const SETTLE_PX = 0.5;
const STATE_ATTRIBUTE = "data-silky-scrolling";
const STYLE = `[${STATE_ATTRIBUTE}] iframe{pointer-events:none}`;

export function silky(options: SilkyOptions = {}): Silky {
  const smoothness = Math.max(1, options.smoothness ?? 1000 / 6);
  const multiplier = options.wheelMultiplier ?? 1;
  const prevent = ["data-silky-prevent", ...(options.preventAttributes ?? [])];
  const own = options.ownSelector;
  const glides = new Map<Element, Glide>();
  let styles = new WeakMap<Element, StyleInfo>();
  let frame = 0;
  let last = 0;

  const style = document.createElement("style");
  style.setAttribute("data-silky", "");
  style.textContent = STYLE;
  document.head.append(style);

  const reducedMotion = options.respectReducedMotion ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function info(element: Element): StyleInfo {
    let cached = styles.get(element);
    if (!cached) {
      const computed = getComputedStyle(element);
      const overflow = computed.overflowY;
      cached = {
        scrolls: overflow === "auto" || overflow === "scroll" || overflow === "overlay"
          || (element === document.scrollingElement && overflow !== "hidden" && overflow !== "clip"),
        contained: computed.overscrollBehaviorY === "contain" || computed.overscrollBehaviorY === "none",
      };
      styles.set(element, cached);
    }
    return cached;
  }

  function limit(element: Element) {
    return Math.max(0, element.scrollHeight - element.clientHeight);
  }

  function prevented(element: Element) {
    for (const name of prevent) if (element.hasAttribute(name)) return true;
    if (element instanceof HTMLTextAreaElement) return element.scrollHeight > element.clientHeight + 1;
    if (element instanceof HTMLSelectElement) return element.size > 1 || element.multiple;
    return element instanceof HTMLInputElement && element.type === "number" && element === document.activeElement;
  }

  /** The scroller this wheel moves: the innermost one that can still move in its direction. */
  function scrollerFor(start: Element, delta: number): Element | null {
    for (let node: Element | null = start; node; node = node.parentElement) {
      if (prevented(node) || (own && node.matches(own))) return null;
      if (node === document.body) break;
      if (node.tagName === "IFRAME" || !info(node).scrolls) continue;
      const room = limit(node);
      if (room < 1) continue;
      const at = glides.get(node)?.target ?? node.scrollTop;
      if ((delta > 0 && at < room - 0.5) || (delta < 0 && at > 0.5)) return node;
      // At its edge: a contained scroller keeps the wheel (no chaining), like native scrolling.
      if (info(node).contained) return null;
    }
    const root = document.scrollingElement;
    if (!root || prevented(root) || !info(root).scrolls) return null;
    const room = limit(root);
    const at = glides.get(root)?.target ?? root.scrollTop;
    return room >= 1 && ((delta > 0 && at < room - 0.5) || (delta < 0 && at > 0.5)) ? root : null;
  }

  function glideTo(element: Element, target: number) {
    let glide = glides.get(element);
    if (!glide) {
      const top = element.scrollTop;
      glide = { element, position: top, target: top, written: top };
      glides.set(element, glide);
      if (glides.size === 1) document.documentElement.setAttribute(STATE_ATTRIBUTE, "");
    }
    glide.target = Math.min(Math.max(0, target), limit(element));
    // The first step covers the time since this wheel, at any refresh rate.
    if (!frame) { last = performance.now(); frame = requestAnimationFrame(step); }
  }

  function finish(glide: Glide) {
    glides.delete(glide.element);
    if (!glides.size) document.documentElement.removeAttribute(STATE_ATTRIBUTE);
  }

  function step(now: number) {
    frame = 0;
    // A long gap (a busy or hidden page) never turns into one huge jump.
    const elapsed = Math.min(Math.max(0, now - last), MAX_STEP_MS);
    last = now;
    const ease = 1 - Math.exp(-elapsed / smoothness);
    for (const glide of glides.values()) {
      const { element } = glide;
      if (!element.isConnected) { finish(glide); continue; }
      // Followed, not fought: the page itself moved this scroller since the last write.
      const current = element.scrollTop;
      if (Math.abs(current - glide.written) > 1) {
        const shift = current - glide.written;
        glide.position += shift;
        glide.target += shift;
      }
      const room = limit(element);
      glide.target = Math.min(Math.max(0, glide.target), room);
      glide.position += (glide.target - glide.position) * ease;
      if (Math.abs(glide.target - glide.position) < SETTLE_PX) glide.position = glide.target;
      element.scrollTop = glide.position;
      glide.written = element.scrollTop;
      if (glide.position === glide.target) finish(glide);
    }
    if (glides.size) frame = requestAnimationFrame(step);
  }

  function settleAll() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const glide of [...glides.values()]) {
      if (glide.element.isConnected) glide.element.scrollTop = glide.target;
      finish(glide);
    }
  }

  const onWheel = (event: WheelEvent) => {
    if (event.defaultPrevented || event.ctrlKey || !(event.target instanceof Element) || reducedMotion?.matches) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const deltaY = event.deltaY * unit, deltaX = event.deltaX * unit;
    if (!deltaY || Math.abs(deltaX) > Math.abs(deltaY) || event.shiftKey) return;
    const element = scrollerFor(event.target, deltaY);
    if (!element) return;
    event.preventDefault();
    const from = glides.get(element)?.target ?? element.scrollTop;
    glideTo(element, from + deltaY * multiplier);
  };
  // Grabbing a scrollbar (or touching) hands the scroller back to the user at once.
  const onPointerDown = (event: PointerEvent) => {
    if (!glides.size || !(event.target instanceof Element)) return;
    for (const glide of [...glides.values()]) if (glide.element.contains(event.target)) finish(glide);
  };
  const onVisibility = () => { if (document.hidden) settleAll(); };
  // Scroller styles rarely change; a resize (a responsive layout) can, so the cache starts over.
  const onResize = () => { styles = new WeakMap(); };

  // Bubble phase: a wheel an inner handler consumed (a chart zoom, a number field) is skipped.
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  return {
    scrollTo(element, top, { immediate = false } = {}) {
      if (immediate) {
        const glide = glides.get(element);
        if (glide) finish(glide);
        element.scrollTop = top;
        return;
      }
      glideTo(element, top);
    },
    get scrolling() { return glides.size > 0; },
    destroy() {
      settleAll();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      style.remove();
    },
  };
}
