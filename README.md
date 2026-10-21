# silky

Smooth wheel scrolling for web apps, light enough that you never feel it in your frame rate.

```ts
import { silky } from "@far3x/silky";

silky(); // every scrollable area on the page now glides
```

One line, no setup per container, no dependencies.

## Why we built it

We built silky for our own trading dashboard and chart: a screen full of panels that scroll on
their own (a live trade feed, holder tables, wallet lists), updating all the time, on fast
monitors. We loved how smooth scrolling felt with Lenis, but on a page like this we wanted it to
cost nothing, keep working no matter what (switching windows or desktops included), and stay
steady while new rows keep arriving. So we wrote our own, tuned to feel the same.

## silky or Lenis?

[Lenis](https://github.com/darkroomengineering/lenis) is the popular choice and a great library.
Pick based on what you are building:

| | silky | Lenis |
| --- | --- | --- |
| Best for | Apps and dashboards with many scrolling panels | Websites and landing pages |
| Setup | One call, every scrollable area works | One instance per area you want smooth |
| Live, updating lists | Stays put while content changes | Can fight content that moves |
| Switching windows or desktops | Always keeps working | Can stop until reload |
| Feel | Same glide as Lenis by default | The original |
| Extras | Just smooth wheel scrolling | Touch, horizontal, snapping, anchors, scroll animations |
| Size | Tiny | Larger |

## Good for

- Dashboards, trading terminals, admin panels, editors
- Apps where the page itself does not scroll but its panels do
- Lists and feeds that update in real time

## Not for

- Touch and trackpad smoothing on phones and tablets (they stay native)
- Horizontal scrolling, snapping, anchor links
- Scroll-driven animations on marketing pages (use Lenis with GSAP for that)

## Options

```ts
silky({
  smoothness: 166.7,          // how long the glide lasts, in ms (higher = softer)
  wheelMultiplier: 1,         // scroll distance per wheel step ("more force")
  preventAttributes: [],      // extra attributes that turn silky off for an element
  ownSelector: ".lenis",      // areas already handled by another smooth scroller
  respectReducedMotion: false // turn off for users who prefer reduced motion
});
```

Add `data-silky-prevent` to any element to keep normal scrolling inside it. Text areas, select
lists, focused number inputs and ctrl+wheel zoom are left alone automatically.

## API

```ts
const s = silky();
s.scrollTo(element, 500);                    // glide to a position
s.scrollTo(element, 0, { immediate: true }); // jump
s.scrolling;                                 // true while gliding
s.destroy();                                 // turn silky off
```

## Install

```sh
npm install @far3x/silky
```

## License

MIT
