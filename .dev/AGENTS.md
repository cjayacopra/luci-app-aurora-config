# .dev — Build/test harness

## OVERVIEW

Host-side build and test harness for luci-app-aurora-config. Sources in `src/resource` are terser-minified into `htdocs/luci-static/resources`; tests slice-and-stub shell and browser modules. Nothing here ships to the router.

## STRUCTURE

- `src/resource/` — ★ EDIT HERE. LuCI view modules + utils (`view/aurora/studio.js`, `view/aurora/marketplace.js`, `utils/*`, `aurora/presets.json`)
- `scripts/` — `build-js.mjs`, `sync-tokens.mjs`, `gen-presets.mjs`, `gen-font-presets.mjs`, `gen-pot.mjs`, `merge-po.mjs`, `translations.json`, `aurora-presets.json`
- `tests/` — 29 `node:test` suites
- `package.json` — pnpm scripts; devDeps pin `@eamonxg/luci-theme-tokens` 3.0.0 + terser
- `.npmrc` — `engine-strict=true`; `engines.node >=20`; `pnpm-lock.yaml` → pnpm is the only package manager

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Build pipeline | `scripts/build-js.mjs` |
| Token vendoring | `scripts/sync-tokens.mjs` |
| Preset templates | `scripts/gen-presets.mjs` |
| Font presets | `scripts/gen-font-presets.mjs` |
| i18n | `scripts/gen-pot.mjs` + `scripts/merge-po.mjs` + `translations.json` |
| Tests | `tests/*.test.mjs` |

## CONVENTIONS

- pnpm only (pnpm-lock.yaml; `engine-strict=true`; node >= 20).
- `build-js.mjs` is the ONLY writer of `htdocs/`. Never write there from anywhere else.
- Terser flags are load-bearing: `parse.bare_returns:true` (LuCI views end in a top-level `return`), `compress.directives:false` (dependency declarations are string directives), `format.comments:false` (licenses re-attached from `.license` sidecars). `mangle.toplevel`/`compress.toplevel` must stay at defaults.
- `@eamonxg/luci-theme-tokens` pinned at 3.0.0 in devDependencies; `sync-tokens.mjs` vendors from that pin.
- `sync-tokens.mjs` stamps `TOKENS_ENGINE_VERSION` into `studio.js` and reruns `gen-presets.mjs`.
- `gen-presets.mjs` only injects colour lines; layout/typography live in the templates and are read back out. `sync-tokens` overwrites `aurora-presets.json` on every sync, so repo-authored data must live where sync never touches.
- `translations.json` (217KB) is the hand-maintained i18n source of truth.

## ANTI-PATTERNS

- Never enable `mangle.toplevel`/`compress.toplevel` in terser — deletes `var Color`/`var AuroraTokens`; output becomes empty, terser still reports success.
- Never hand-edit `htdocs/` — fix `src/resource`, rebuild, commit both.
- Never edit vendored `tokens.global.js` / `color-tokens.conf` / `aurora-presets.json` — regenerate via `pnpm sync-tokens`.
- Never add a self-built fetch URL without a version — `__ASSET_HASH(...)__` or a stamped constant; unknown path fails the build.
- Never retype a font stack — copy verbatim from `font-presets.conf` field 7.

## COMMANDS

```bash
cd .dev                      # all commands run from here
pnpm build                   # src/resource -> htdocs (terser)
pnpm check                   # build-js.mjs --check; exits 1 on stale/orphan artifacts
pnpm test                    # --check first, then node --test tests/*.test.mjs
pnpm sync-tokens             # vendor tokens.global.js + color-tokens.conf + aurora-presets.json from npm pin; --local <path> for unreleased iteration; --check mode
pnpm gen-presets             # rewrite *.template colour block + src/resource/aurora/presets.json
pnpm gen-font-presets        # regenerate font-presets.conf (downloads woff2, computes sha256)
```