import type { Engine } from './direct-text';
let engine: Promise<Engine> | undefined;
export function getEngine(): Promise<Engine> {
  const url = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/mupdf/mupdf.js`;
  engine ??= import(/* webpackIgnore: true */ url).catch(error => { engine = undefined; throw error; }) as Promise<Engine>;
  return engine;
}
