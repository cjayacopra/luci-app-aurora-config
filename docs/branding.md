# The ShiranekoWrt Branding

What a fresh flash lands on: the `shiranekowrt` built-in preset, its wiring
from template to first-install seeding to store card to token engine, and how
to change it. This is the ShiranekoWrt-specific companion to
[DEVELOPMENT.md](DEVELOPMENT.md), which covers the general machinery; where a
decision here only makes sense against that machinery, it is cross-referenced
with the same `§N` notation the Development Guide uses.

---

## 1. The look: a whole look, not a palette

`shiranekowrt` is the sixth built-in preset, and the one a fresh install
seeds. A preset here is never just a palette — it is a whole look: the 62
colour options *and* a structural block (nav shape, spacing, radius, content
width, typefaces, the toolbar switch), all written together by
`apply_theme_preset` (§4A). ShiranekoWrt pulls every lever, which is what the
"six presets are six different looks" test exists to guarantee.

### 1.1 The palette

Light mode is Kanagawa Lotus turned into a cream-paper page; dark mode keeps
the Kanagawa Dragon canvas (warm ink-black) but swaps the near-white Dragon
foreground for the classic Kanagawa fujiWhite, the warm cream the palette is
known for. The inputs are worth reading in pairs, because the cream is the
load-bearing choice:

| Token | Light | Dark |
| --- | --- | --- |
| `bg` | `#f2ecbc` (cream paper) | `#181616` (ink) |
| `surface` | `#e7dba0` | `#282727` |
| `text` | `#545464` | `#dcd7ba` (fujiWhite) |
| `brand` | `#4d699b` | `#8ba4b0` |
| `on_brand` | `#f2ecbc` | `#181616` |
| `link` | `#4d699b` | `#8ba4b0` |

The remaining derived values (text_muted, surface_sunken, hover_faint,
mega_menu_bg, the status surfaces, and the rest) are computed from these
inputs by the token engine — §4 is why that computation had to change for this
preset to work.

### 1.2 The structure

The structural block in `root/usr/share/aurora/shiranekowrt.template`:

- **Typefaces** — `struct_font_sans '"Nunito", "Lato", ui-sans-serif, …'`,
  `struct_font_mono '"Maple Mono", ui-monospace, …'`.
- **Spacing** `0.25rem`; **content width** `92rem`; **corner radius**
  `0.625rem`; **nav shape** `sidebar`; **toolbar on**.

The nav shape is the load-bearing choice here, the way the cream is in the
palette. A sidebar is the shell for a daily-driver dashboard: the rail sits in
view on every page, its first column already spends the horizontal margin, and
the content runs full-width. That is also why the spacing scale came down a
stop (`0.3rem` → `0.25rem`): the loose stop needs a centred layout with a wide
content column to breathe, and the sidebar shell has none — the test suite
enforces exactly that rule (§4A's spacing test).
- **A shared background** — both `struct_login_bg` and `struct_main_bg` point
  at `url('/luci-static/aurora/images/background.png')`: one wallpaper for the
  login page and the main interface.

`background.png` is a *theme-shipped* image, not a user asset: it was added to
`THEME_SHIPPED_NAMES` in `marketplace.js` and to `is_theme_shipped_image()` in
`luci.aurora` in the same breath (§8.5's "skips factory-default images" rule
then never treats it as a customisation worth uploading).

### 1.3 The toolbar

Seven shortcut items, the daily-driver pages of the firmware this ships on:

| Item | URL | Icon |
| --- | --- | --- |
| Network | `/cgi-bin/luci/admin/network/network` | `network.svg` |
| WiFi | `/cgi-bin/luci/admin/network/wireless` | `wifi.svg` |
| Modemdata | `/cgi-bin/luci/admin/modem/modemdata` | `5G.svg` |
| QModem | `/cgi-bin/luci/admin/modem/qmodem` | `QModem.svg` |
| Xray | `/cgi-bin/luci/admin/services/xray_core` | `xray.svg` |
| Bandix | `/cgi-bin/luci/admin/network/bandix` | `stats.svg` |
| GHFU | `/cgi-bin/luci/admin/system/ghfu` | `update.svg` |

All seven icons ship with the theme package, so the preset references them by
name with nothing to upload — and the shipped-names parity test
(`marketplace-view.test.mjs` vs `is_theme_shipped_image`) keeps it that way.

---

## 2. How a fresh install lands on it

`root/etc/uci-defaults/80_aurora` seeds the config on first boot. `main()`
picks the seeding template through a fallback chain, and `SHIRANEKOWRT_TEMPLATE`
(`/usr/share/aurora/shiranekowrt.template`) is now **first** in that chain,
ahead of the old `default.template`. A fresh flash therefore copies the
shiranekowrt template straight into `/etc/config/aurora` — no browser, no
store, no user interaction.

### 2.1 Keeping the store honest after a schema reset

The schema-reset path (`migrate_color_schema()`) had to be tightened in the
same change, or the store would lie about what the router is wearing:

- after overwriting the config with the template, it now sets
  `aurora.theme.active_preset` to the template's preset id (derived from the
  template basename), and
- deletes `active_source` and `active_fingerprint`.

Why: the config after a reset *is* the template, so the store must re-derive
the source from scratch — `ensure_active_source` does that when
`active_source` is empty. Keeping the old `active_source` would leave the "In
use" tick on the pre-reset card while the config underneath had already moved.

A shiranekowrt-seeded install would otherwise have shown "Default" as in use:
`ensure_active_source` normalises an unset `active_preset` to `default`
(`normalize_preset_name` on an empty value). Recording the preset id is what
makes the tick land on the right card.

---

## 3. How the store shows it

`BUILTIN_PRESETS` in `marketplace.js` now opens with
`{ id: "shiranekowrt", label: "ShiranekoWrt" }`.

### 3.1 The label is a bare string on purpose

The label is deliberately **not** `_("ShiranekoWrt")`. "ShiranekoWrt" is a
proper noun — wrapping it in `_()` would mint a new msgid that needs a `po`
entry in every language to keep the po-format checks green. It is a brand name
that does not translate; the bare string says exactly that, in code, so nobody
"helpfully" wraps it later.

### 3.2 The hub seed is not listed twice

`BUILTIN_SEED_RE` was extended to
`/^(ShiranekoWrt|Default|Sage Green|Amber Sand|Monochrome|Sky Blue)\b/`. The
hub does not expose a `builtin_id` field yet, so the only stable signal for
"this store card is the same thing as that built-in preset" is author + name
(§8.1). Without the regex update, the hub's own seed of ShiranekoWrt would
render as a second, confusing copy of the same theme.

`PRESETS_VERSION` — the content hash the store appends to its `?v=` when
fetching `aurora/presets.json` (§11's cache-busting table) — was bumped with
the roster change.

### 3.3 The "In use" tick

When the active config came from the shiranekowrt template — seeded at
install (§2), applied from the card, or re-derived after a schema reset
(§2.1) — `hub_local_state` reports the source and the card shows "In use".

---

## 4. The setguard operator: why the token engine went v3.0.0

The vendored `@eamonxg/luci-theme-tokens` engine was bumped 2.0.0 → 3.0.0 (pin
in `.dev/package.json`; `TOKENS_ENGINE_VERSION` in `studio.js` stamped 3.0.0;
the vendoring pipeline is §3.4).

### 4.1 The operator

v3.0.0 adds a new derivation operator, `setguard(a, L, Ch, guard)`:

```
L  ← min(L, base.L − guard)     // never lighter than guard below the canvas
Ch ← max(Ch, base.Ch)           // chroma floor, like `set`
```

That is "`set`, but pinned at least `guard` below its own canvas".

### 4.2 The bug it fixes

The old `set` operator placed derived fills at an *absolute* lightness target
(`surface_sunken` at 0.975, `hover_faint` at 0.95, `mega_menu_bg` at 0.972).
On the near-white default canvas those read as recessed surfaces.

On a **saturated light canvas** — shiranekowrt's cream paper has `light_bg`
at L ≈ 0.936 — those same absolute targets land *lighter than the canvas
itself*. The "recessed" fill reads as a white patch floating on the page, and
worse, on cream it is a *tinted* white patch (absolute lightness plus the
canvas's chroma), which is what makes it look dirty rather than subtle.

`setguard` pins the fill below its own canvas instead:

| Token | guard |
| --- | --- |
| `surface_sunken` | `9e-3` |
| `hover_faint` | `0.034` |
| `mega_menu_bg` | `0.012` |

### 4.3 Why this, not per-preset overrides

The guard is **relative**, so the same three derivations stay correct on every
preset — cream paper and near-white alike get a fill that is recessed *by
construction*. Per-preset hex overrides would have special-cased one preset's
palette inside the engine; `setguard` keeps the derivation a single rule and
lets the canvas define what "recessed" means.

---

## 5. Changing the branding later

### Retune the colours

Colours come from upstream: `@eamonxg/luci-theme-tokens` owns the `PRESETS`
map in `aurora/presets.js` (each preset is the 10 inputs × light/dark), and
this repo vendors the resolved hex (§3.4). To change ShiranekoWrt's palette,
edit the map upstream, bump the pin in `.dev/package.json`, run
`sync-tokens.mjs`, build, test — the full recipe is §4A.

### Retune the structure

The structural block lives in the template's non-colour tail,
`root/usr/share/aurora/shiranekowrt.template` — hand-edit it, then re-run
`gen-presets.mjs` so the store's `presets.json` copy follows. Respect the two
rules the tests enforce (§4A): slider-step values inside the hub's bounds, and
font stacks copied verbatim from `font-presets.conf`.

### Change which look a fresh flash lands on

Edit the fallback chain order in `main()` of
`root/etc/uci-defaults/80_aurora`, keeping the preset-id recording in
`migrate_color_schema()` consistent (§2.1).

### Change the toolbar

Edit the `config toolbar_item` sections in the template. Respect the toolbar
validation rules — ≤12 entries and the per-field limits (§8.5).

### Change the background

Swap `background.png` in the theme package (`luci-theme-aurora`); the preset
only references the path. It is theme-shipped, so nothing here needs to
change — and nothing should ever be uploaded for it (§1.2).

### New engine release

Bump the pin in `.dev/package.json` → `sync-tokens.mjs` → build → test. If the
release adds an operator (like `setguard` did in 3.0.0), the derivation table
in §4.2 is where the guard choices are recorded (§4B).

### The tests that keep it honest

- `.dev/tests/builtin-presets.test.mjs` pins `PRESET_IDS` — now
  `[default, shiranekowrt, sage-green, amber-sand, monochrome, sky-blue]` —
  and demands the six presets be six distinct looks: each owns its corner
  radius, the roster spans the whole sans roster (`SANS_ROSTER_SIZE`, six
  presets across five faces), nav shape and spacing and content width vary,
  and at least one preset turns the toolbar off.
- `marketplace-view.test.mjs` keeps `THEME_SHIPPED_NAMES` in step with the
  backend's `is_theme_shipped_image` — the thing that decides what is
  uploaded when a config is shared (§8.5).
