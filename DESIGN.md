---
name: Kiosk Operational Clarity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2151da'
  primary: '#0037b0'
  on-primary: '#ffffff'
  primary-container: '#1d4ed8'
  on-primary-container: '#cad3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#004f35'
  on-tertiary: '#ffffff'
  tertiary-container: '#006948'
  on-tertiary-container: '#76eab6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b5'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-kiosk:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  body-xl:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  price-display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-kiosk: 2rem
  margin: 2rem
  margin-kiosk: 3rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1.25rem
  space-lg: 2rem
  space-xl: 3rem
---

## Brand & Style

The design system is engineered specifically for high-throughput, self-service automated print and photocopy touchscreen terminals situated in bustling Indian retail environments. The interface directly resolves chaotic print-shop friction points: noise, ambient screen glare, standing physical posture, rapid user turnover, and linguistic diversity.

### Visual Style
The aesthetic is a union of **Industrial Functionalism** and **Tactile Modernism**:
- **High-contrast hierarchy:** Information is visually prioritized so standing operators or first-time retail customers can absorb document settings and totals at an arm's distance (60–90 cm).
- **Physical predictability:** Interactive elements behave like physical switches and tactile pads rather than subtle web hyperlinks. Tap zones are generously proportioned, with immediate micro-state feedback to eliminate double-tap errors.
- **Atmospheric restraint:** Surfaces are predominantly clinical white and cool slate, allowing vibrant operational blues, processing ambers, and validation greens to serve purely informative roles without visual noise.

## Colors

The palette is tuned for high ambient lighting conditions in retail shops, preventing glare-induced misreadings and ensuring absolute accessibility.

- **Primary (`#1D4ED8`)**: High-luminance Cobalt Blue. Drives main kiosk actions (e.g., "Proceed to Pay", "Print Now", "Confirm Settings").
- **Secondary / Surface Dark (`#0F172A`)**: Deep Slate. Used for high-emphasis typographic layers, critical headings, and terminal state indicators.
- **Tertiary / Success (`#059669`)**: Crisp Emerald. Communicates successful file uploads, valid UPI verification, device readiness, and finished print jobs.
- **Warning / Alert (`#D97706`)**: Amber. Applied to low paper alerts, queue positions, duplex alignment caveats, or document aspect mismatch notifications.
- **Error / Danger (`#DC2626`)**: Direct Crimson. Strictly reserved for hardware jams, scan alignment failures, payment timeouts, and cancellation prompts.
- **Neutral Canvas (`#F8FAFC`)**: Glare-reducing off-white background preventing eye fatigue under fluorescent shop lighting.
- **Surface Elevation (`#FFFFFF`)**: Pure white cards and floating touch panels offering sharp separation against the neutral canvas.
- **Borders & Dividers (`#E2E8F0` & `#CBD5E1`)**: Crisp tactile borders defining functional touch blocks.

## Typography

Typography is calibrated to account for standing reading angles, variable user vision, and finger-occlusion while tapping.

- **Zero Micro-Copy Policy**: Font sizes below 15px are strictly prohibited across the kiosk experience. Secondary instructional details utilize `body-md` (16px) with medium or regular weights.
- **Numerical Stacking**: Prices, page counters, and job timers use proportional tabular lining via `Plus Jakarta Sans` to prevent layout shift during recalculations.
- **Weight Pairing**: Display headings and action triggers leverage medium-to-bold cuts (600–800) to withstand retail glare and motion blur.

## Layout & Spacing

Kiosk hardware deployment demands a stable, predictable layout model anchored by standard portrait/landscape commercial touchscreen ratios (1080x1920 or 1920x1080).

- **Structure**: A fixed 12-column grid utilizing `gutter-kiosk` (32px) and an outer safe canvas boundary of `margin-kiosk` (48px). Edge margins ensure fingers do not bump into physical kiosk metal bezels.
- **Ergonomic Zone Allocation**:
  - **Upper 20% (Header & Progress Stepper)**: Informational only; displays live step progress, current network/printer readiness, and language switcher.
  - **Middle 55% (Operational Canvas)**: Active manipulation area (document viewing, page-range selection, color mode, quantity adjustment).
  - **Lower 25% (Execution Dock)**: Fixed, sticky bottom shelf containing live order total, print summary token, and the primary touch progression trigger (minimum 64px height).

## Elevation & Depth

Visual hierarchy does not rely on complex lighting models or heavy atmospheric blurs, which render poorly on low-cost kiosk displays. Depth is defined through high-contrast boundary structuring:

- **Level 0 (Base Canvas)**: Neutral `#F8FAFC` plane, flat, non-interactive.
- **Level 1 (Structural Cards)**: Pure white `#FFFFFF` surface with a continuous 1.5px border (`#E2E8F0`) and an ambient, low-spread drop shadow: `0px 4px 12px rgba(15, 23, 42, 0.05)`.
- **Level 2 (Active/Selected States & Dropzones)**: Border weight steps up to 2.5px `#1D4ED8` with a diffused directional shadow: `0px 8px 24px rgba(29, 78, 216, 0.12)`.
- **Level 3 (Modals, Overlays, and Bottom Docks)**: Crisp elevated white sheets hovering above a 60% tint `#0F172A` scrim, supported by `0px 20px 40px rgba(15, 23, 42, 0.20)`.

## Shapes

The design uses balanced, rounded geometries (Level 2: base radius 0.5rem / 8px; standard cards 1rem / 16px; modal sheets and buttons 1.5rem / 24px).

- **Tactile Invocation**: Large corner radii on buttons and selectable cards trigger immediate affordance for finger presses, visually separating interactive modules from static tabular summaries.
- **Circular Indicators**: Stepper milestone markers and page number pills maintain perfect 9999px pill shapes for instantaneous optical centering.

## Components

### 1. Kiosk Flow Stepper
- **Layout**: Top-fixed horizontal sequence: `1. Upload` -> `2. Configure` -> `3. Pay` -> `4. Printing`.
- **States**: Inactive (Slate-200 border, slate muted text), Active (Cobalt background pill, bold white text, animated pulse ring), Completed (Emerald checkmark with filled circle).
- **Target Size**: 44px node height, connected by 3px rigid connector bars.

### 2. Touch Buttons
- **Touch Standard**: Strict minimum hit area of 56px height, expanding to 68px for the global bottom action bar.
- **Primary Button**: Solid `#1D4ED8` background, 24px border radius, white `label-lg` typography. Active tap triggers a momentary -2px scale transform with a `#1E40AF` fill.
- **Secondary Button**: Crisp `#FFFFFF` surface with 2px `#CBD5E1` border and `#0F172A` text.
- **Destructive/Cancel**: Outlined Crimson `#DC2626` with explicit icon and text to prevent accidental walkaways.
- **Disabled**: `#F1F5F9` background, `#94A3B8` label, completely non-responsive to capacitive touch.

### 3. Selection Chips & Toggles (Color vs. B&W, Paper Size)
- **Format**: Large dual-state blocks (minimum 80px x 100px) containing an icon, title, and differential unit pricing (e.g., "₹2/page" vs "₹10/page").
- **Selected State**: Outlined with 2.5px `#1D4ED8`, subtle 8% blue tint fill, and top-right check badge.

### 4. Interactive Dropzone & File Importers
- **Format**: Dashed 2.5px border (`#94A3B8`), generous 48px internal padding.
- **Actions**: Massive tactile touch cards for `WhatsApp QR Upload`, `USB Flash Drive`, and `Cloud Document PIN`.

### 5. Document Preview Canvas
- **Viewport**: Centered vertical card presentation with clear high-contrast page counters (`Page 3 of 12`).
- **Touch Controls**: Oversized left/right navigation arrows (64px x 64px touch target) positioned safely outside the document boundary. Zoom and rotate paddles docked below.

### 6. Payment Method Selectors
- **UPI Focus**: Dominant card format featuring a direct static dynamic QR code frame (`220px x 220px`) with high contrast, paired with clear animated indicators for GPay, PhonePe, and Paytm.
- **Card / Cash Options**: Secondary split-row touch panels with clear availability status chips.

### 7. Live Printing Progress Engine
- **Visuals**: Circular or horizontal progress bar with a minimum height of 20px, filled with Emerald `#059669`.
- **Live Metas**: Large numerical percentage display (`display-kiosk`), remaining page countdown, and real-time tray output status.

### 8. System Alert & Jam Modals
- **Alert Standard**: High-visibility center modal with 32px padding, stark `#DC2626` header icons, step-by-step visual instruction diagrams, and a dedicated persistent "Call Shop Attendant" button.