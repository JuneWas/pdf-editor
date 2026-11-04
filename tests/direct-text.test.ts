import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as m from 'mupdf';
import { readLines, replaceLine } from '../lib/direct-text.ts';
function fixture() {
  const doc = new m.PDFDocument();
  const font = new m.Font('Helvetica');
  const resources = { Font: { F1: doc.addSimpleFont(font) } };
  for (const text of ['Original text', 'Other page']) doc.insertPage(-1, doc.addPage([0, 0, 400, 500], 0, resources, `0 1 0 rg 0 0 30 30 re f BT /F1 24 Tf 0 0 0 rg 40 400 Td (${text}) Tj ET`));
  const buffer = doc.saveToBuffer(''); const bytes = buffer.asUint8Array().slice();
  buffer.destroy(); font.destroy(); doc.destroy(); return bytes;
}
test('removes original content, embeds extractable Japanese and preserves other pages', () => {
  const bytes = fixture(); const line = readLines(m, bytes, 0)[0];
  const result = replaceLine(m, bytes, 0, line, '日本語');
  assert.equal(readLines(m, result, 0).map(l => l.text).join(''), '日本語');
  assert.equal(readLines(m, result, 1)[0].text, 'Other page');
  assert.equal(readLines(m, bytes, 0)[0].text, 'Original text');
  const oldDoc = new m.PDFDocument(bytes), newDoc = new m.PDFDocument(result);
  const oldPage = oldDoc.loadPage(0), newPage = newDoc.loadPage(0);
  const oldPix = oldPage.toPixmap(m.Matrix.identity, m.ColorSpace.DeviceRGB, false);
  const newPix = newPage.toPixmap(m.Matrix.identity, m.ColorSpace.DeviceRGB, false);
  // Vector background well below the text must stay unchanged.
  assert.deepEqual(newPix.getPixels().slice(-400 * 3 * 40), oldPix.getPixels().slice(-400 * 3 * 40));
  oldPix.destroy(); newPix.destroy(); oldPage.destroy(); newPage.destroy(); oldDoc.destroy(); newDoc.destroy();
});
test('deletion, repeated editing, unsupported direction, multiline and overflow', () => {
  const bytes = fixture(); const line = readLines(m, bytes, 0)[0];
  assert.equal(readLines(m, replaceLine(m, bytes, 0, line, ''), 0).length, 0);
  const changed = replaceLine(m, bytes, 0, line, '日本語');
  assert.equal(readLines(m, replaceLine(m, changed, 0, readLines(m, changed, 0)[0], '変更'), 0)[0].text, '変更');
  assert.throws(() => replaceLine(m, bytes, 0, { ...line, editable: false }, 'x'), /縦書き/);
  assert.throws(() => replaceLine(m, bytes, 0, line, 'x\ny'), /1行/);
  assert.throws(() => replaceLine(m, bytes, 0, line, 'Very long replacement text that exceeds its original width'), /幅/);
});
