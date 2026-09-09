// FEAT-037: CSS side-effect imports (@xyflow/react/dist/style.css) are
// resolved and emitted by the esbuild CSS loader; tsc only needs to know
// such modules exist. This file must stay a GLOBAL script (no imports) so
// the pattern module declaration is ambient.
declare module '*.css';
