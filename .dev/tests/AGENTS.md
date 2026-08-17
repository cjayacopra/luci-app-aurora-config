# .dev/tests — AGENTS.md

## OVERVIEW
29 node:test suites (ESM, node:assert/strict, Node >= 20) that verify the
luci-app-aurora-config package without a device: rpcd shell logic, browser
modules, the vendored token engine, and the shipped htdocs bytes.

## STRUCTURE
- rpcd backend (slice-and-stub shell): rpcd-hub, rpcd-init-data, rpcd-main-bg,
  rpcd-one-slot, rpcd-share-assets, rpcd-theme-asset-handoff,
  rpcd-toolbar-handoff, rpcd-upload-validation, feed-rpcd
- browser modules (new Function + stub globals): feed-check-module,
  hub-api-module, theme-preview-module, asset-upload-module,
  theme-upload-integration, marketplace-view, studio-bg-styles, studio-layout,
  studio-main-bg, theme-color-editor-regressions, feed-ui
- vendored engine (vm.runInContext): theme-token-metadata, theme-token-sync
- shipped artifact bytes: artifact-safety, build-js
- data/presets/i18n: builtin-presets, font-presets, po-format
- removed-feature regression locks: hub-rpcd-removed, version-removed

## CONVENTIONS
- Assert against SOURCES (.dev/src/resource) unless the artifact itself is the
  thing under test. Only artifact-safety + build-js read htdocs bytes.
- paths.mjs is the only shared helper: repo(rel) -> repo root, srcPath(rel) ->
  .dev/src/resource. Never depend on cwd; pnpm test runs from .dev.
- srcPath is deliberately not named `src`: tests bind `const src = await
  readFile(...)` and would shadow it.
- Some tests are regression locks with the bug story in a comment. Chinese
  comments appear in several rpcd/studio suites.
- Never assert on source text when behavior can be executed.

## UNIQUE TEST TECHNIQUES
- Slice-and-stub shell: rpcd suites slice functions out of
  root/usr/libexec/rpcd/luci.aurora and run them under `sh` with stubbed
  uci/jshn/md5sum (all OpenWrt-only). Stubs log calls; assertions check emitted
  behavior (what a function takes, drops, orders), not source shape. md5sum is
  stubbed to cksum because busybox md5sum is absent on macOS.
- Browser modules: strip `"require"` directives, run the body under
  `new Function` with stub globals (L, E, uci, rpc, baseclass...). Pure
  functions actually run, not pattern-matched.
- Vendored globals: color.global.js + tokens.global.js load via
  vm.runInContext into a sandbox, returning real AuroraTokens/Color.
- theme-token-sync runs sync-tokens.mjs --check. Skips only on transient
  network failure (HTTP 5xx, ENOTFOUND, ECONNREFUSED, ETIMEDOUT); a 4xx means
  a broken pin and must fail.
- artifact-safety asserts the bytes the router serves: every artifact parses
  under new Function (top-level return is legal there), require directives
  survive minification, globals survive, .license banners, no sourceMappingURL,
  _() msgids byte-for-byte, __ASSET_HASH resolved, no hidden files.

## COMMANDS
- Run everything: `pnpm test` from .dev/ = build-js.mjs --check first, then
  node --test tests/*.test.mjs. --check fails on stale artifacts.
- Single suite: `node --test tests/rpcd-one-slot.test.mjs` from .dev/.