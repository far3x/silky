# silky

**Smooth wheel scrolling for web apps that scroll inside containers — built to never cost you a frame.**

```ts
import { silky } from "@far3x/silky";

silky(); // every scrollable container on the page now glides
```

~220 lines, zero dependencies, no configuration, no per-container setup.

---

## Why silky exists

silky was written for a real-time trading terminal: a chart, a live trade tape, holder tables,
wallet lists — a dozen independent scroll containers on one screen, rows arriving several times a
second, on 144–240 Hz monitors. The page used [Lenis](https://github.com/darkroomengineering/lenis),
the most popular smooth-scrolling library (~17k GitHub stars, ~1.1M npm downloads a week), and
loved the feel. But profiling the app showed three problems that come from how a general-purpose
smooth scroller is built, not from bugs:

1. **It stalled after a window or desktop switch.** A JS smooth scroller is a frame loop. When the
   browser hides a window it stops delivering frames; a loop that believes a frame is pending never
   asks for another, and every later wheel is swallowed (smooth scrollers must `preventDefault` the
   wheel) without moving the page. Users had to reload.
2. **It fought live content.** When rows are inserted above the viewport, the page (or the browser's
   scroll anchoring) moves the scroll position to keep the reader in place. A smooth scroller that
   owns the position pulls it back toward its own idea of where you are — the list shakes or jumps.
3. **It added main-thread work where frames were already tight.** Class toggles on the scroller at
   every start/stop restyle its whole subtree; per-instance loops, emitters and option checks run on
   every frame and every wheel.

silky keeps the feel — by default it glides exactly like Lenis' default — and removes those costs.

## What it does differently

| | silky | Lenis |
| --- | --- | --- |
| Scope | **Every** scroll container, found under the pointer at wheel time | One instance per wrapper you create |
| Nested scrollers | Chain like native scrolling; `overscroll-behavior: contain` respected | Per instance (`allowNestedScroll`) |
| Frame loop | One shared loop, **only while something glides** | One loop per instance (`autoRaf`) or yours |
| Hidden window / desktop switch | Finishes every glide at once — can never stall | Depends on frame delivery |
| Content moved by the page mid-glide | **Followed**: the glide shifts with it | Overwritten by the animated position |
| Per frame | One `scrollTop` read + write per gliding scroller | Animation, emitter, class name updates |
| DOM state | One attribute on `<html>` per gesture (not per frame) | Classes on the wrapper (`lenis-scrolling`, `lenis-smooth`) |
| Easing | Exponential, frame-rate independent (same at 60/144/240 Hz) | Lerp or duration + easing curve |
| Size | ~220 lines, no dependencies | Larger, richer feature set |

## Use cases

- Dashboards, terminals, admin panels and editors: many scroll containers, live updates.
- Apps where the document itself does not scroll (`overflow: hidden` shell, scrolling panes).
- Any page that wants smooth wheels without wiring an instance per container.

## When to use Lenis instead

Be honest with yourself — Lenis does more:

- **Touch smoothing** (`syncTouch`), **horizontal** and **infinite** scrolling, **snap** (lenis/snap),
  **anchor links** with offsets, scroll **events** for scroll-driven animations, React/Vue wrappers.
- Marketing and landing pages built around scroll-linked animation (GSAP ScrollTrigger etc.).
- A large, battle-tested community.

silky deliberately does one thing: smooth **vertical mouse-wheel** scrolling of containers.

## Negatives and limits

- Wheel only: touch, trackpad momentum on touch devices, horizontal and shift-wheels stay native.
- No scroll events, anchors, snapping or easing curves beyond the exponential glide.
- Like every JS smooth scroller it moves the page from the main thread: a page that blocks the
  main thread for 100 ms will hitch for 100 ms. (Native browser scrolling runs on the compositor and
  does not; that is the price of the smooth feel. silky keeps its own share of each frame tiny.)
- Young project, tested on Chromium-based browsers first.

## Options

```ts
silky({
  smoothness: 166.7,          // glide time constant in ms; higher = longer, softer (default: Lenis' feel)
  wheelMultiplier: 1,         // scales wheel deltas ("more force")
  preventAttributes: [],      // extra opt-out attributes besides data-silky-prevent
  ownSelector: ".lenis",      // ancestors whose scrollers run another smooth scroller
  respectReducedMotion: false // native scrolling for users who prefer reduced motion
});
```

Opt any subtree out with `data-silky-prevent`. Native scrolling is also kept for text areas that
can scroll, list boxes, focused number inputs, ctrl+wheel (zoom), and wheels another handler
already handled (`event.defaultPrevented`). While anything glides, `<html>` carries
`data-silky-scrolling` and iframes ignore the pointer, so an embedded chart sliding under the
cursor does not steal the wheel.

## API

```ts
const s = silky(options);
s.scrollTo(element, top);                    // glide
s.scrollTo(element, top, { immediate: true }); // jump
s.scrolling;                                 // true while anything glides
s.destroy();                                 // remove listeners, finish glides
```

## Install

```sh
npm install @far3x/silky
```

## License

MIT
