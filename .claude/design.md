# Design system

The visual language for basekit. Every component, every page, every email follows this file.

---

## Brand personality

Five adjectives. Choose every UI decision against these.

1. **Direct** — say what something does in fewest words. No "Unleash the power of…" copy. No coy CTAs.
2. **Technical** — developers are the audience. Use code voice, show real values, avoid hand-wavy abstractions.
3. **Confident** — no apologies, no "we hope you like it" footers. Strong typography, strong color, decisive spacing.
4. **Production-ready** — looks shippable, not prototyped. No placeholder gray boxes, no lorem ipsum in screenshots.
5. **Minimal-with-warmth** — disciplined whitespace, but the teal accents prevent it from feeling cold.

Never: cute mascots, illustrated characters, hand-drawn doodles, gradient meshes, glassmorphism, neumorphism.

---

## Typography

**Heading + body:** Inter via `next/font/google` — weights 400, 500, 600, 700, 800.
**Mono:** JetBrains Mono via `next/font/google` — weight 400, 500. Used for prices, code snippets, env var names, plan IDs.

### Scale (size / weight / line-height / letter-spacing)

| Token | Size | Weight | Line-height | Tracking | Use |
|-------|------|--------|-------------|----------|-----|
| `text-hero` | 56px (mobile 40px) | 800 | 1.05 | -0.05em | Landing H1 only |
| `text-display` | 40px (mobile 32px) | 800 | 1.1 | -0.04em | Landing section titles |
| `text-h1` | 32px | 700 | 1.2 | -0.03em | Page H1 inside the app |
| `text-h2` | 24px | 700 | 1.25 | -0.02em | Card titles, section headers |
| `text-h3` | 18px | 600 | 1.3 | -0.01em | Subsections |
| `text-body` | 14px | 400 | 1.65 | 0 | Default body |
| `text-small` | 12px | 500 | 1.5 | 0 | Helper text, metadata |
| `text-micro` | 10px | 700 | 1.4 | 0.14em (uppercase) | Labels, badges, table headers |

All sizes use `rem`. Tailwind config defines a custom scale matching these tokens.

---

## Color system

All colors live as CSS variables in `app/globals.css`. Tailwind reads them via `@theme`. **Never hardcode a hex value in a component** — reference the semantic variable.

### Primary brand palette (teal)

| Step | Hex | Use |
|------|-----|-----|
| `teal-50` | `#F0FDFA` | Active sidebar item bg, hover bg, soft chips |
| `teal-100` | `#CCFBF1` | Borders for active states, dividers in branded sections |
| `teal-200` | `#99F6E4` | (rare) accent fills |
| `teal-300` | `#5EEAD4` | (rare) |
| `teal-400` | `#2DD4BF` | Brand color on dark backgrounds (`kit` wordmark on dark) |
| `teal-500` | `#14B8A6` | (mid-tone, rarely used in UI) |
| `teal-600` | `#0D9488` | **Primary brand color** — wordmark on light, primary CTA bg |
| `teal-700` | `#0F766E` | Primary button hover |
| `teal-800` | `#115E59` | Pressed state, very dark accent text |
| `teal-900` | `#134E4A` | (rare) |
| `teal-950` | `#042F2E` | Pricing card pro background on dark mode |

### Action / accent palette

| Step | Hex | Use |
|------|-----|-----|
| `indigo-500` | `#6366F1` | Users metric accent (admin) |
| `green-500` | `#10B981` | Success states, "trialing" badge text |
| `amber-500` | `#F59E0B` | Conversion metric accent, trial-ending warning |
| `rose-500` | `#F43F5E` | Churn metric accent, errors |

### Neutral palette (light mode)

| Token | Hex | Role |
|-------|-----|------|
| `neutral-0` | `#FFFFFF` | Surfaces, cards |
| `neutral-50` | `#FAFAF9` | App background |
| `neutral-100` | `#F5F5F4` | Hover bg on neutral chips |
| `neutral-200` | `#E7E5E4` | Default border |
| `neutral-400` | `#A8A29E` | Muted text, disabled |
| `neutral-600` | `#57534E` | Secondary text |
| `neutral-900` | `#0A0A0A` | Primary text, hero bg on dark sections |

### Neutral palette (dark mode)

| Token | Hex | Role |
|-------|-----|------|
| `neutral-0` | `#0A0A0A` | App background |
| `neutral-50` | `#141414` | Surface (cards) |
| `neutral-100` | `#1E1E1E` | Default border |
| `neutral-200` | `#2A2A2A` | Hover border |
| `neutral-400` | `#666666` | Muted text |
| `neutral-600` | `#A8A29E` | Secondary text |
| `neutral-900` | `#FAFAFA` | Primary text |

### Semantic colors

| Semantic | Light bg | Light text | Light border | Dark bg | Dark text | Dark border |
|----------|----------|------------|--------------|---------|-----------|-------------|
| `success` | `#ECFDF5` | `#047857` | `#A7F3D0` | `#022C22` | `#34D399` | `#065F46` |
| `warning` | `#FFFBEB` | `#B45309` | `#FDE68A` | `#1F1300` | `#FBBF24` | `#78350F` |
| `danger` | `#FEF2F2` | `#DC2626` | `#FECACA` | `#1F0606` | `#F87171` | `#7F1D1D` |
| `info` | `#F0F9FF` | `#0369A1` | `#BAE6FD` | `#0C1929` | `#38BDF8` | `#075985` |

### Subscription status colors (first-class statuses)

| Status | Color token |
|--------|-------------|
| `active` | `success` |
| `trialing` | `info` |
| `past_due` | `warning` |
| `canceled` | `neutral` (muted) |
| `incomplete` | `warning` |
| `unpaid` | `danger` |

---

## CSS variables (in `app/globals.css`)

```css
:root {
  /* surface + text */
  --bg-app: #FAFAF9;
  --bg-surface: #FFFFFF;
  --bg-surface-hover: #F5F5F4;
  --bg-overlay: rgba(10, 10, 10, 0.5);

  --text-primary: #0A0A0A;
  --text-secondary: #57534E;
  --text-muted: #A8A29E;
  --text-on-brand: #FFFFFF;

  --border-default: #E7E5E4;
  --border-strong: #A8A29E;
  --border-brand: #0D9488;

  --brand-primary: #0D9488;
  --brand-hover: #0F766E;
  --brand-active: #115E59;
  --brand-bg-soft: #F0FDFA;
  --brand-border-soft: #CCFBF1;
  --brand-on-dark: #2DD4BF;

  --shadow-sm: 0 1px 2px rgba(10, 10, 10, 0.04);
  --shadow-md: 0 4px 12px rgba(10, 10, 10, 0.06);
  --shadow-brand: 0 4px 14px rgba(13, 148, 136, 0.25);

  --radius-sm: 6px;
  --radius-md: 9px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}

.dark {
  --bg-app: #0A0A0A;
  --bg-surface: #141414;
  --bg-surface-hover: #1E1E1E;
  --bg-overlay: rgba(0, 0, 0, 0.7);

  --text-primary: #FAFAFA;
  --text-secondary: #A8A29E;
  --text-muted: #666666;
  --text-on-brand: #FFFFFF;

  --border-default: #1E1E1E;
  --border-strong: #2A2A2A;
  --border-brand: #2DD4BF;

  --brand-primary: #0D9488;
  --brand-hover: #2DD4BF;
  --brand-active: #5EEAD4;
  --brand-bg-soft: #0F1F1E;
  --brand-border-soft: #115E59;
  --brand-on-dark: #2DD4BF;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
  --shadow-brand: 0 4px 18px rgba(45, 212, 191, 0.2);
}
```

---

## Layout & shell specs

| Element | Spec |
|---------|------|
| Sidebar width (desktop) | 240px |
| Sidebar collapsed (tablet) | 64px (icons only) |
| Topbar height | 56px |
| Detail panel width (settings right panel) | 400px |
| Content max width | 1280px |
| Page padding (desktop) | 32px |
| Page padding (mobile) | 16px |
| Mobile bottom nav height | 64px (includes safe-area inset) |

### Z-index scale (use these, never raw numbers)

```css
--z-base: 0;
--z-sticky: 10;          /* sticky table headers */
--z-sidebar: 20;
--z-topbar: 30;
--z-mobile-nav: 40;
--z-dropdown: 50;
--z-tooltip: 60;
--z-dialog: 70;
--z-toast: 80;
--z-impersonate-banner: 90;  /* always on top */
```

---

## Component specs

### Button

| Variant | Background | Text | Border | Shadow | Hover |
|---------|------------|------|--------|--------|-------|
| `primary` | `--brand-primary` | white | none | `--shadow-brand` | bg → `--brand-hover` |
| `secondary` | `--bg-surface` | `--text-primary` | 2px `--text-primary` | none | bg → `--bg-surface-hover` |
| `ghost` | transparent | `--text-secondary` | 1.5px `--border-default` | none | bg → `--bg-surface-hover` |
| `danger` | `danger.bg` | `danger.text` | 1px `danger.border` | none | bg → slightly darker |

**Shared:** `border-radius: var(--radius-md)`, `font-weight: 700`, `font-size: 13px`, `padding: 10px 16px`, `transition: 120ms ease`.
**States:** `:focus-visible` adds `outline: 2px solid var(--brand-primary); outline-offset: 2px`. `:disabled` lowers opacity to 0.5 and `cursor: not-allowed`. Loading state shows a spinner replacing the leading icon and changes label to a present participle.
**Sizes:** `sm` (8px / 12px padding, 12px text), `md` (default), `lg` (14px / 20px padding, 14px text).

### Card

```
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
}
```
- Hoverable variant: adds `transition` on `box-shadow`, lifts to `--shadow-md` on hover.
- Metric card variant: adds `border-left: 3px solid var(--metric-color)`.

### Badge

| Variant | Bg | Text | Border |
|---------|----|----- |--------|
| `neutral` | `--bg-surface-hover` | `--text-secondary` | none |
| `brand` | `--brand-bg-soft` | `--brand-primary` | 1px `--brand-border-soft` |
| `success` | semantic | semantic | semantic |
| `warning` | semantic | semantic | semantic |
| `danger` | semantic | semantic | semantic |
| `info` | semantic | semantic | semantic |

**Shared:** `font-size: 10px`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.14em`, `padding: 4px 8px`, `border-radius: var(--radius-sm)`.

### Form field

| State | Background | Border | Text |
|-------|------------|--------|------|
| Default | `--bg-surface` | 1px `--border-default` | `--text-primary` |
| Focus | `--bg-surface` | 2px `--brand-primary` | `--text-primary` |
| Error | `--bg-surface` | 2px `danger.text` | `--text-primary`, helper text in `danger.text` |
| Disabled | `--bg-surface-hover` | 1px `--border-default` | `--text-muted` |

`border-radius: var(--radius-md)`, `padding: 10px 12px`, `font-size: 14px`. Labels are 12px / 600 / `--text-secondary` above the input.

### Sidebar nav item

| State | Bg | Text | Font weight |
|-------|----|----- |-------------|
| Default | transparent | `--text-secondary` | 500 |
| Hover | `--bg-surface-hover` | `--text-primary` | 500 |
| Active | `--brand-bg-soft` | `--brand-primary` | 600 |

Active item gets `border-left: 3px solid var(--brand-primary)`. Icon is 18px, text is 14px.

---

## Spacing system

Base unit: **4px**. Tailwind defaults are used directly.

| Token | px | Use |
|-------|-----|-----|
| `space-1` | 4 | tight inline gaps |
| `space-2` | 8 | label → input |
| `space-3` | 12 | small padding |
| `space-4` | 16 | default card inner gap |
| `space-6` | 24 | card padding, section gap |
| `space-8` | 32 | page padding |
| `space-12` | 48 | between major page sections |
| `space-16` | 64 | landing section vertical rhythm (mobile) |
| `space-24` | 96 | landing section vertical rhythm (desktop) |

---

## Motion rules

- **Duration range:** 80ms (micro) → 250ms (panel open) → 400ms (page transition). Never longer.
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard) for everything. No bouncing, no overshooting.
- **Always animate:** dialogs (fade + slight scale), toasts (slide-in from bottom), panels (slide-in from edge), accordions (height), button hover (color/bg).
- **Never animate:**
  - Data tables (rows must not shift when sorting)
  - Lists with >20 items (re-ordering causes vestibular discomfort and FLIP cost)
  - Counter numbers (no spinning odometers — instantaneous swap)
  - Page-to-page navigation in the app shell (instant)
- **Reduced motion:** respect `prefers-reduced-motion: reduce` everywhere — drop all animation, keep only the final state.

---

## Responsive strategy

| Breakpoint | Tailwind | Width | Layout change |
|------------|----------|-------|---------------|
| Mobile | (default) | < 640px | Single column, bottom nav, sidebar hidden, tables become cards, page padding 16px |
| Tablet | `md:` | ≥ 768px | Sidebar collapsed to icons (64px), tables visible, page padding 24px |
| Desktop | `lg:` | ≥ 1024px | Sidebar full (240px), detail panels visible, page padding 32px |
| Wide | `xl:` | ≥ 1280px | Content max-width caps at 1280px and centers |

Marketing pages use larger breakpoints (`sm:`, `lg:`, `xl:`) for hero scaling.

---

## Mobile adaptations

- **Bottom nav** replaces sidebar on mobile. Five items max: Dashboard, Projects, Team, Billing, Settings. Active item shows the teal bar above the icon.
- **Detail panels** (settings, member detail) push the list off-screen instead of overlaying — back button in topbar returns to list.
- **Tables convert to cards** on mobile. Each row becomes a card with primary content top, secondary content beneath, actions in a popover. Never horizontal-scroll a table.
- **Tap targets:** minimum **44 × 44px** for any interactive element. Inline links inside paragraphs are exempt.
- **No hover-only affordances:** anything that reveals on hover must also be reachable via a tap (kebab menu, dropdown).
- **Drag interactions:** never use hover-to-show-handle. Drag handle is always visible on touch devices.
- **Sticky headers:** topbar is sticky on scroll; the page H1 below it is not (gives content vertical room).
- **iOS safe area:** bottom nav uses `env(safe-area-inset-bottom)` for padding. Sticky topbar uses `env(safe-area-inset-top)`.

---

## Strict don'ts

These will never appear in basekit's UI. If a PR introduces one, it gets bounced.

- Drop shadows on text
- Gradient backgrounds on buttons or cards (the radial teal glow on the pricing section is the ONE exception)
- Glassmorphism / frosted glass / backdrop-blur on UI surfaces
- Neumorphism / soft inset shadows
- Emoji in UI labels or marketing copy (icons only — Tabler icons)
- Cursors set to `pointer` on non-interactive elements
- Hover-revealed primary actions (must be visible by default)
- Sentence-case + Title Case mixed within the same section
- More than 3 font weights on a single page
- More than 2 levels of nested cards
- Bouncy / springy animations on functional UI (only on the landing hero, if anywhere)
- Skeletons that show for less than 100ms (just don't show the skeleton at all)
- Empty states without a primary CTA
- Loading spinners larger than 24px in body content (page-level loading uses a top progress bar or skeleton)
- "Loading…" text without a visual element
