import esbuild from "esbuild";
import path from "path";

const watch = process.argv.includes("--watch");

async function main() {
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

  const webviewCtx = await esbuild.context({
    entryPoints: ["src/webview/index.tsx"],
    bundle: true,
    format: "esm",
    minify: !watch,
    sourcemap: watch,
    platform: "browser",
    outfile: "dist/webview.js",
    loader: { ".css": "css" },
  });

  // FEAT-021: integration test entry points (Mocha-based, run by
  // @vscode/test-electron). Compiled to CJS in out/ (not dist/) so
  // it does NOT ship in the production VSIX. External: vscode is
  // provided by the host VS Code at runtime.
  //
  // Three entry points are compiled, one per file, so each output
  // can have its own .cjs extension (esbuild's `outdir` mode
  // would emit .js, which trips Node's ESM/CJS detection):
  //   - runIntegrationTests.cjs: the OUTSIDE-VS-Code script
  //     (executed by `npm run test:integration` directly). It
  //     calls `runTests(...)` from @vscode/test-electron.
  //   - bootstrap.cjs: the INSIDE-VS-Code script (executed by
  //     the extension host after the extension is activated).
  //     It exports a `run()` function that drives Mocha.
  //   - criticalPath.test.cjs: the actual test file, loaded by
  //     bootstrap via Mocha's `addFile()`.
  const integrationEntryPoints = [
    { in: "src/test/integration/runIntegrationTests.ts", out: "runIntegrationTests.cjs" },
    { in: "src/test/integration/bootstrap.ts",          out: "bootstrap.cjs" },
    { in: "src/test/integration/criticalPath.test.ts",  out: "criticalPath.test.cjs" },
  ];
  const integrationContexts = await Promise.all(
    integrationEntryPoints.map((ep) =>
      esbuild.context({
        entryPoints: [ep.in],
        bundle: true,
        format: "cjs",
        minify: !watch,
        sourcemap: watch,
        external: ["vscode"],
        platform: "node",
        outfile: `out/test/integration/${ep.out}`,
      })
    )
  );

  if (watch) {
    await extensionCtx.watch();
    await webviewCtx.watch();
    for (const ctx of integrationContexts) {
      await ctx.watch();
    }
    console.log("Watching for changes...");
  } else {
    await extensionCtx.rebuild();
    await webviewCtx.rebuild();
    for (const ctx of integrationContexts) {
      await ctx.rebuild();
    }
    await extensionCtx.dispose();
    await webviewCtx.dispose();
    for (const ctx of integrationContexts) {
      await ctx.dispose();
    }
    console.log("Build complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
