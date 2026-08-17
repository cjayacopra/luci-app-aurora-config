# luci-app-aurora-config — Knowledge Base

**Generated:** 2026-08-17
**Commit:** e614796
**Branch:** shiranekowrt/branding

## OVERVIEW

LuCI configuration UI for the Aurora theme: Theme Studio (colors, layout,
typography, branding, toolbar), Configuration Marketplace (browse/apply/share
themes), and a POSIX-sh rpcd backend that writes UCI. Frontend is plain
LuCI `E()` DOM (no React/Vue); the only build step is terser minification.
Rendering lives in `luci-theme-aurora`; this repo owns the config UI + UCI
writes.

## STRUCTURE

```
luci-app-aurora-config/
├── .dev/                 # Build/test harness (pnpm). JS source of truth + tooling + tests
│   ├── src/resource/     # ★ EDIT HERE. LuCI view modules + utils (minified → htdocs)
│   ├── scripts/          # build-js.mjs (ONLY htdocs writer), sync-tokens, gen-* pipelines
│   └── tests/            # 29 node:test suites (slice-and-stub shell, new Function browser)
├── htdocs/               # GENERATED (committed). Minified JS, served verbatim by uhttpd
├── root/                 # Installed-as-is OpenWrt overlay: rpcd backend, uci-defaults, templates, ACLs
├── po/                   # i18n: pot + 14 languages (custom gen-pot/merge-po pipeline)
├── docs/                 # DEVELOPMENT.md (canonical, §1-§11), branding.md (ShiranekoWrt), plans
└── .github/workflows/    # build-and-release, token-sync-check, claude-issue-bot, claude-pr-review
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Theme Studio UI | `.dev/src/resource/view/aurora/studio.js` | 3.9k lines: color editor, layout, branding, toolbar, fonts |
| Marketplace UI | `.dev/src/resource/view/aurora/marketplace.js` | 3.7k lines: store cards, share, my-shares |
| Backend RPC | `root/usr/libexec/rpcd/luci.aurora` | POSIX sh + jshn; all `hub_*`, `apply_*`, `upload_*` methods |
| First-boot setup | `root/etc/uci-defaults/80_aurora` | SCHEMA_VERSION=7; migration + template seeding |
| Preset templates | `root/usr/share/aurora/*.template` | Colour block GENERATED; layout block hand-authored |
| Token pipeline | `.dev/scripts/sync-tokens.mjs` → `tokens.global.js`, `color-tokens.conf`, `aurora-presets.json` | Vendored from the ShiranekoWrt fork checkout (`../luci-theme-tokens`, branding branch); npm pin is last resort only |
| Build pipeline | `.dev/scripts/build-js.mjs` | ONLY writer of htdocs; terser with LuCI-specific flags |
| Canonical dev doc | `docs/DEVELOPMENT.md` | §1-§11; §11 = jsmin horror story, read before touching build |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `persistDerivedTokens` | fn | `studio.js:2041` | Expands 10 inputs → all tokens via `AuroraTokens.resolve`, writes 30 `light_*`/`dark_*` UCI keys |
| `runSavePipeline` | fn | `studio.js:2057` | Save chain: colorLibraryReady → editor flush → super.handleSave → persistDerivedTokens → uci.save → writePwaManifest |
| `toRuntimeColor` | fn | `studio.js:453` | Normalizes any color to hex via vendored Color; wraps in try/catch, returns raw on failure |
| `colorLibraryReady` | const | `studio.js:65` | Async gate loading `color.global.js` + `tokens.global.js` (versioned via `__ASSET_HASH`/`TOKENS_ENGINE_VERSION`) |
| `PRESETS` | const | luci-theme-tokens fork `aurora/presets.js:19` | 6 presets incl. `shiranekowrt` (Kanagawa Lotus cream); resolved in the fork build, vendored here |
| `resolveTokens`/`resolveMode` | fn | luci-theme-tokens `aurora/index.js` | The 5-operator token engine; this repo only consumes prebuilt `dist/aurora/*` |
| rpcd `list`/`call` dispatch | case | `luci.aurora:2937,3007` | Method table; ACL in `root/usr/share/rpcd/acl.d/luci-app-aurora.json` must match |

## CONVENTIONS

- **Edit `.dev/src/resource/` only. Never hand-edit `htdocs/`** — build-js.mjs is the sole writer; `pnpm build` regenerates, `pnpm test` runs `--check` first and fails on stale artifacts.
- **Source and artifact travel together** in one commit ("an edit is not finished until it has been built").
- **Generated, never hand-edit:** `htdocs/luci-static/resources/**`, `utils/tokens.global.js`, `root/usr/share/aurora/color-tokens.conf` + `*.template` colour block, `font-presets.conf`, `aurora-presets.json`, `.dev/src/resource/aurora/presets.json`, `po/templates/aurora-config.pot`.
- **Version scheme:** `PKG_VERSION` semantic (bump at least a patch for breaking schema changes) + `PKG_RELEASE` YYYYMMDD; git tags `v*`. Before tagging: `cd .dev && pnpm test` + `git status --porcelain` must be empty.
- **Token changes bump `SCHEMA_VERSION`** in `80_aurora` and add a comment (stale UCI keys become dangling overrides otherwise).
- **Custom i18n:** `gen-pot.mjs`/`merge-po.mjs` replace LuCI's `i18n-scan.pl`; `translations.json` is the hand-maintained source of truth (217KB).

## ANTI-PATTERNS (THIS PROJECT)

- **Never enable `mangle.toplevel`/`compress.toplevel`** in terser — deletes `var Color`/`var AuroraTokens`; output becomes empty, terser still reports success (white page).
- **Never use `innerHTML` for hub-sourced text** (untrusted server content) — use `E()` safe children / `createTextNode`. Palette hex additionally sanitized before `color-mix()`.
- **Never use `eval`** in rpcd — validation is `case`/`grep -E` only; no embedded-newline UCI injection.
- **Never hand-edit minified htdocs** to "fix" a bug — fix the source, rebuild, commit both.
- **Never edit vendored `tokens.global.js`/`color-tokens.conf`/`aurora-presets.json`** — regenerate via `pnpm sync-tokens` (drift caught by `token-sync-check.yml` + tests).
- **Never add a self-built fetch URL without a version** — `__ASSET_HASH(...)__` or a stamped constant; unknown path fails the build.
- **Never retype a font stack** — must be copied verbatim from `font-presets.conf` field 7, or the device reverse-map fails silently.

## UNIQUE STYLES

- **Two-layer JS pipeline:** sources in `.dev/src/resource` → terser minify in place (no bundler, no transpiler) → `htdocs/luci-static/resources`. LuCI's own loader resolves `"require utils.hub-api as hubApi"` over HTTP, so merging files would break it.
- **`.gitattributes` marks `htdocs/luci-static/resources/**` `linguist-generated`** — diffs there fold away; read sources.
- **ACL group name ≠ package name:** ACL/menu use `luci-app-aurora`, package is `luci-app-aurora-config`.
- **rpcd tests slice shell functions** out of `luci.aurora` and run them under `sh` with stubbed `uci`/`jshn`/`md5sum`; browser modules get `require` directives stripped and run under `new Function` with stub globals.
- **Branch policy:** work only on `shiranekowrt/*` feature branches; `master` is upstream-tracking only (fetch + fast-forward, never commit).

## COMMANDS

```bash
cd .dev                      # ALL commands run from here (pnpm; node >= 20, engine-strict)
pnpm build                   # .dev/src/resource/ -> htdocs/luci-static/resources/ (terser)
pnpm check                   # build-js.mjs --check — names stale/orphan artifacts, exits 1
pnpm test                    # --check first, then node --test tests/*.test.mjs
pnpm sync-tokens             # vendor tokens.global.js + color-tokens.conf + presets from the fork checkout (../luci-theme-tokens); npm pin last resort
pnpm gen-presets             # rewrite *.template colour block + src/resource/aurora/presets.json
pnpm gen-font-presets        # regenerate font-presets.conf (downloads woff2, computes sha256)
sh -n ../root/usr/libexec/rpcd/luci.aurora   # shell syntax check (not covered by pnpm test)
sh -n ../root/etc/uci-defaults/80_aurora
```

## NOTES

- **Artifacts are committed because uhttpd has no gzip** — every byte is a flash read + socket write on the router, and the feed builds from git refs. Minified bytes must be in git for anyone's build to get them.
- **SDK build runs no Node/build step** — it installs committed `htdocs/` + `root/` verbatim. A stale tree at a tag ships old frontend against new backend, and nothing downstream notices.
- **`docs/DEVELOPMENT.md` §11 explains why `LUCI_MINIFY_JS:=0`** — luci.mk's default jsmin (Crockford, 1990s) corrupts ES6: regex-after-arrow becomes division, template-literal `//` eaten as comment, multi-line CSS `.a .b` squeezed to `.a.b`. Terser replaces it.
- **Themes/configs are a whole look, not a palette** — 62 colour options + structural block (nav_type, spacing, radius, width, fonts, toolbar). Templates and browser `presets.json` are two shapes of the same data, kept in sync by `gen-presets.mjs` + tests.