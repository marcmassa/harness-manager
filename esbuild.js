import esbuild from "esbuild";
import path from "path";
import fs from "fs";

const watch = process.argv.includes("--watch");

/**
 * Remove build outputs that no entry point produces any more.
 *
 * Without this, a bundle from a removed entry point lingers in dist/ forever and
 * is swept into the VSIX by `vsce package`: 0.8.0 was about to ship a 57 KB
 * extension.js from the 0.1.0 era and a 335 KB sddManager.js whose entry point
 * was deleted months ago — ~390 KB of code that never executes. dist/ is
 * gitignored, so nothing else would ever have caught it.
 */
function pruneStaleDistOutputs(expected) {
  if (!fs.existsSync("dist")) return;
  const keep = new Set(expected);
  for (const name of fs.readdirSync("dist")) {
    if (keep.has(name)) continue;
    fs.rmSync(path.join("dist", name), { recursive: true, force: true });
    console.log(`Pruned stale build output: dist/${name}`);
  }
}

async function main() {
  // Every file the build legitimately produces. webview.css is emitted by the
  // CSS loader alongside webview.js; sourcemaps only exist in watch mode.
  pruneStaleDistOutputs([
    "extension.cjs", "webview.js", "webview.css",
    "extension.cjs.map", "webview.js.map", "webview.css.map",
  ]);

  const extensionCtx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: !watch,
    sourcemap: watch,
    external: ["vscode"],
    platform: "node",
    outfile: "dist/extension.cjs",
  });

  const webviewEntryPoints = [
    { in: "src/webview/index.tsx", out: "webview.js" },
  ];

  const webviewContexts = await Promise.all(
    webviewEntryPoints.map((ep) =>
      esbuild.context({
        entryPoints: [ep.in],
        bundle: true,
        format: "esm",
        minify: !watch,
        sourcemap: watch,
        platform: "browser",
        outfile: `dist/${ep.out}`,
        loader: { ".css": "css" },
      })
    )
  );

  // FEAT-021: integration test entry points (Mocha-based, run by
  // @vscode/test-electron). Compiled to CJS in out/ (not dist/) so
  // it does NOT ship in the production VSIX.
  //
  // Three entry points are compiled, one per file, so each output
  // can have its own .cjs extension (esbuild's `outdir` mode
  // would emit .js, which trips Node's ESM/CJS detection):
  //   - runIntegrationTests.cjs: the OUTSIDE-VS-Code script
  //     (executed by `npm run test:integration` directamente). It
  //     calls `runTests(...)` from @vscode/test-electron. Imports
  //     only @vscode/test-electron; no mocha.
  //   - bootstrap.cjs: the INSIDE-VS-Code script (executed by
  //     the extension host after the extension is activated).
  //     It exports a `run()` function that drives Mocha. Imports
  //     `mocha` (must be `external` so esbuild does not bundle
  //     it — mocha's internals use `require.resolve('./worker.js')`
  //     and `require.resolve('./reporters/parallel-buffered')`,
  //     which break when mocha is bundled into a single file).
  //   - criticalPath.test.cjs: the actual test file, loaded by
  //     bootstrap via Mocha's `addFile()`. Imports only `vscode`
  //     (and Node stdlib).
  //
  // Each entry point declares its own `external` list because the
  // transitive imports differ. `vscode` is the host API (provided
  // by VS Code at runtime). `mocha` is only used by bootstrap.
  const integrationEntryPoints = [
    {
      in: "src/test/integration/runIntegrationTests.ts",
      out: "runIntegrationTests.cjs",
      external: ["vscode"],
    },
    {
      in: "src/test/integration/bootstrap.ts",
      out: "bootstrap.cjs",
      // Mocha is marked external here (not bundled). Bundling mocha
      // breaks `require.resolve('./worker.js')` and
      // `require.resolve('./reporters/parallel-buffered')` because
      // those paths are relative to `node_modules/mocha/lib/nodejs/`
      // and do not exist once mocha is inlined into a single CJS
      // file. esbuild emits two warnings ("should be marked as
      // external for use with require.resolve") when mocha is
      // bundled; this external entry silences them and restores
      // the full mocha feature set (parallel test execution,
      // progress reporters, etc.).
      external: ["vscode", "mocha"],
    },
    {
      in: "src/test/integration/criticalPath.test.ts",
      out: "criticalPath.test.cjs",
      external: ["vscode"],
    },
  ];
  const integrationContexts = await Promise.all(
    integrationEntryPoints.map((ep) =>
      esbuild.context({
        entryPoints: [ep.in],
        bundle: true,
        format: "cjs",
        minify: !watch,
        sourcemap: watch,
        external: ep.external,
        platform: "node",
        outfile: `out/test/integration/${ep.out}`,
      })
    )
  );

  if (watch) {
    await extensionCtx.watch();
    for (const ctx of webviewContexts) {
      await ctx.watch();
    }
    for (const ctx of integrationContexts) {
      await ctx.watch();
    }
    console.log("Watching for changes...");
  } else {
    await extensionCtx.rebuild();
    for (const ctx of webviewContexts) {
      await ctx.rebuild();
      await ctx.dispose();
    }
    for (const ctx of integrationContexts) {
      await ctx.rebuild();
      await ctx.dispose();
    }
    await extensionCtx.dispose();
    console.log("Build complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
