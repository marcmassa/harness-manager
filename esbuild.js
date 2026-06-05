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
    outfile: "dist/extension.js",
  });

  const webviewCtx = await esbuild.context({
    entryPoints: ["src/webview/index.tsx"],
    bundle: true,
    format: "esm",
    minify: !watch,
    sourcemap: watch,
    platform: "browser",
    outfile: "dist/webview.js",
  });

  if (watch) {
    await extensionCtx.watch();
    await webviewCtx.watch();
    console.log("Watching for changes...");
  } else {
    await extensionCtx.rebuild();
    await webviewCtx.rebuild();
    await extensionCtx.dispose();
    await webviewCtx.dispose();
    console.log("Build complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
