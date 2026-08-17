import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import vm from "node:vm";
import { repo, srcPath } from "./paths.mjs";

const RES = srcPath("utils");

// Load the vendored browser engine (color.global.js -> tokens.global.js) the
// config UI runs at runtime. Returns { AuroraTokens, Color }.
async function loadConfigEngine() {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(await readFile(resolve(RES, "color.global.js"), "utf8"), sandbox);
  vm.runInContext(await readFile(resolve(RES, "tokens.global.js"), "utf8"), sandbox);
  return { AuroraTokens: sandbox.AuroraTokens, Color: sandbox.Color };
}

const hexOf = (Color, value) =>
  new Color(value).to("srgb").toString({ format: "hex" }).toLowerCase();

// Parse `option <mode>_<key> '<value>'` lines into { light: {...}, dark: {...} }.
function parseTemplate(source) {
  const out = { light: {}, dark: {} };
  for (const line of source.split("\n")) {
    const m = line.match(/^\s*option\s+(light|dark)_([a-z_]+)\s+'([^']+)'/);
    if (m) out[m[1]][m[2]] = m[3];
  }
  return out;
}

// Guards the bug fixed in gen-presets.mjs: the config UI loads the 10 inputs as
// hex and recomputes derived tokens from them to decide "automatic vs override"
// (syncDerivedInitialState in view/aurora/studio.js). If a template seeds a
// derived value that disagrees with that recompute by even one 8-bit step, a
// clean preset misreads it as a manual override and shows a value in the box.
// Two seed kinds are legal: (1) the engine's own recompute from the template's
// hex inputs, and (2) a preset-pinned override -- the shiranekowrt preset pins
// accessible text_muted/text_subtle for its cream canvas -- which must match
// the vendored preset registry (aurora-presets.json) that gen-presets emits
// the template colour block from.
test("preset templates seed derived tokens consistent with the engine recompute", async () => {
  const { AuroraTokens, Color } = await loadConfigEngine();
  const registry = JSON.parse(
    await readFile(repo(".dev/scripts/aurora-presets.json"), "utf8"),
  );
  const presetDir = repo("root/usr/share/aurora");
  const files = (await readdir(presetDir)).filter((name) =>
    name.endsWith(".template"),
  );
  assert.ok(files.length > 0, "preset templates exist");

  for (const file of files) {
    const name = file.replace(/\.template$/, "");
    const stored = parseTemplate(await readFile(resolve(presetDir, file), "utf8"));
    for (const mode of ["light", "dark"]) {
      const inputs = {};
      for (const key of AuroraTokens.INPUTS) {
        assert.ok(
          stored[mode][key],
          `${file}: missing input ${mode}_${key}`,
        );
        inputs[key] = stored[mode][key];
      }
      const resolved = AuroraTokens.resolve(mode, inputs);
      const registryPreset = registry.presets?.[name]?.[mode] ?? {};
      for (const key of AuroraTokens.DERIVED_KEYS) {
        const seeded = hexOf(Color, stored[mode][key]);
        const recomputed = hexOf(Color, resolved[key]);
        if (seeded === recomputed) continue;
        assert.ok(
          registryPreset[key],
          `${file}: ${mode}_${key} seed deviates from the engine recompute ` +
            "but the preset registry carries no override for it",
        );
        assert.equal(
          seeded,
          hexOf(Color, registryPreset[key]),
          `${file}: ${mode}_${key} seed must match the preset registry override`,
        );
      }
    }
  }
});

// The rpcd script validates presets/imports against the key list shipped in
// color-tokens.conf. That file is generated from the same registry the browser
// engine embeds, but nothing at runtime rechecks it -- this does. Runs in
// standalone CI (no sibling repo needed).
test("color-tokens.conf lists exactly the engine's tokens, inputs first", async () => {
  const { AuroraTokens } = await loadConfigEngine();
  const conf = await readFile(
    repo("root/usr/share/aurora/color-tokens.conf"),
    "utf8",
  );
  const keys = conf
    .split("\n")
    .filter((line) => line && !line.startsWith("#"));

  assert.deepEqual(
    keys,
    Array.from(AuroraTokens.INPUTS).concat(
      Array.from(AuroraTokens.DERIVED_KEYS),
    ),
  );
});

// theme.js loads tokens.global.js with ?v=TOKENS_ENGINE_VERSION so browsers
// refetch the engine whenever it changes, instead of pairing a fresh theme.js
// with an HTTP-cached engine from a previous release ("stale color token
// metadata" errors). The stamp is written by sync-tokens.mjs; verify it
// matches the version baked into the vendored engine's header.
test("theme.js cache-busts the token engine with the vendored version", async () => {
  const theme = await readFile(
    srcPath("view/aurora/studio.js"),
    "utf8",
  );
  const engine = await readFile(resolve(RES, "tokens.global.js"), "utf8");
  const stamped = theme.match(/const TOKENS_ENGINE_VERSION = "([^"]+)";/)?.[1];
  const vendored = engine.match(/@eamonxg\/luci-theme-tokens v(\S+)/)?.[1];
  assert.ok(stamped, "theme.js declares TOKENS_ENGINE_VERSION");
  assert.ok(vendored, "tokens.global.js header carries its version");
  assert.equal(stamped, vendored);
});

// tokens.global.js and color-tokens.conf are vendored from the ShiranekoWrt
// luci-theme-tokens fork (the sibling checkout; it carries the shiranekowrt
// preset, the setguard operator and v3.0.0 that the upstream npm package
// lacks). Rerun sync-tokens in --check mode and fail on drift, so neither a
// stale vendor nor a hand-edit can land unnoticed. Without a fork checkout,
// sync-tokens falls back to the pinned npm version; it skips only on transient
// network/server failures -- a 4xx (e.g. 404 for an unpublished pin) means the
// pin itself is broken and must FAIL, not skip.
test("vendored token artifacts are in sync with the pinned package", async (t) => {
  try {
    await promisify(execFile)(process.execPath, [
      repo(".dev/scripts/sync-tokens.mjs"),
      "--check",
    ]);
  } catch (error) {
    const message = String(error?.stderr ?? error);
    if (/HTTP 5\d\d|fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/.test(message)) {
      t.skip("registry unreachable and no sibling luci-theme-tokens checkout");
      return;
    }
    throw error;
  }
});
