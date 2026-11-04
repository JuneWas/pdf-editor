import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/mupdf', { recursive: true });
for (const file of ['mupdf.js', 'mupdf-wasm.js', 'mupdf-wasm.wasm']) await copyFile(`node_modules/mupdf/dist/${file}`, `public/mupdf/${file}`);
await copyFile('node_modules/mupdf/LICENSE', 'public/mupdf/LICENSE');
