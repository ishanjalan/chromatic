import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const watch = process.argv.includes('--watch');

mkdirSync('dist', { recursive: true });

// Bundle the plugin sandbox code
const codeCtx = await esbuild.context({
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  target: 'es2017',
  format: 'iife',
});

// Bundle the UI script
const uiCtx = await esbuild.context({
  entryPoints: ['src/ui.ts'],
  bundle: true,
  outfile: 'dist/ui-bundle.js',
  target: 'es2020',
  format: 'iife',
});

await codeCtx.rebuild();
await uiCtx.rebuild();

// Inline CSS + JS into a single HTML file for the Figma plugin UI
const html = readFileSync('src/ui.html', 'utf8');
const css = readFileSync('src/ui.css', 'utf8');
const js = readFileSync('dist/ui-bundle.js', 'utf8');
const inlined = html
  .replace('<!-- CSS -->', `<style>${css}</style>`)
  .replace('<!-- JS -->', `<script>${js}</script>`);
writeFileSync('dist/ui.html', inlined);

if (watch) {
  console.log('Watching for changes...');
  await codeCtx.watch();
  await uiCtx.watch();
} else {
  await codeCtx.dispose();
  await uiCtx.dispose();
}
