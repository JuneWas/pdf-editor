import type * as MuPDF from 'mupdf';
export type Engine = typeof MuPDF;
export type TextLine = { id: number; text: string; box: MuPDF.Rect; origin: MuPDF.Point; size: number; color: number[]; quads: MuPDF.Quad[]; editable: boolean };
export function readLines(m: Engine, bytes: Uint8Array, index: number): TextLine[] {
  const doc = new m.PDFDocument(bytes);
  const page = doc.loadPage(index);
  const text = page.toStructuredText('');
  const lines: TextLine[] = [];
  let line: TextLine;
  try {
    text.walk({
      beginLine(box, mode, direction) { line = { id: lines.length, text: '', box, origin: [box[0], box[3]], size: 12, color: [0, 0, 0], quads: [], editable: mode === 0 && Math.abs(direction[0] - 1) < .01 && Math.abs(direction[1]) < .01 }; },
      onChar(char, origin, _font, size, quad, color) { if (!line.text) { line.origin = origin; line.size = size; line.color = [...color]; } line.text += char; line.quads.push(quad); },
      endLine() { if (line.text.trim()) lines.push(line); },
    });
    return lines;
  } finally { text.destroy(); page.destroy(); doc.destroy(); }
}
// Replacement changes the actual content stream. No white rectangle or text annotation.
export function replaceLine(m: Engine, bytes: Uint8Array, index: number, line: TextLine, replacement: string): Uint8Array<ArrayBuffer> {
  if (!line.editable) throw new Error('縦書き・回転した文字行の編集にはまだ対応していません。');
  if (/[\r\n]/.test(replacement)) throw new Error('既存文字は1行ずつ編集してください。');
  const doc = new m.PDFDocument(bytes);
  const page = doc.loadPage(index);
  const font = new m.Font('ja');
  try {
    const glyphs = [...replacement].map(char => font.encodeCharacter(char));
    if (glyphs.some(glyph => glyph === 0)) throw new Error('置換用フォントで表示できない文字が含まれています。');
    const width = glyphs.reduce((sum, glyph) => sum + font.advanceGlyph(glyph) * line.size, 0);
    if (width > line.box[2] - line.box[0] + 1) throw new Error('文字が元の行の幅を超えます。短い内容に変更してください。');
    const redact = page.createAnnotation('Redact');
    redact.setQuadPoints(line.quads);
    // Only apply our annotation; preserve unrelated pending redactions, images and vector graphics.
    redact.applyRedaction(0, m.PDFPage.REDACT_IMAGE_NONE, m.PDFPage.REDACT_LINE_ART_NONE, m.PDFPage.REDACT_TEXT_REMOVE);
    redact.destroy();
    const obj = page.getObject();
    const resources = doc.newDictionary();
    obj.getInheritable('Resources').forEach((value, key) => resources.put(key, value));
    const fonts = doc.newDictionary();
    const existing = resources.get('Font');
    if (!existing.isNull()) existing.forEach((value, key) => fonts.put(key, value));
    const name = `Studio${doc.countObjects()}`;
    fonts.put(name, doc.addFont(font)); resources.put('Font', fonts); obj.put('Resources', resources);
    const matrix = m.Matrix.invert(page.getTransform());
    const color = line.color.length === 3 ? line.color : [0, 0, 0];
    const encoded = glyphs.map(glyph => glyph.toString(16).padStart(4, '0')).join('');
    const contents = doc.newArray(); contents.push(doc.addStream('q\n', {}));
    const old = obj.get('Contents');
    if (old.isArray()) old.forEach(value => contents.push(value)); else if (!old.isNull()) contents.push(old);
    contents.push(doc.addStream(`\nQ\nq\n${matrix.join(' ')} cm\n${color.join(' ')} rg\nBT /${name} ${line.size} Tf 1 0 0 -1 ${line.origin.join(' ')} Tm <${encoded}> Tj ET\nQ`, {}));
    obj.put('Contents', contents);
    const output = doc.saveToBuffer('garbage=4,compress');
    try { return output.asUint8Array().slice(); } finally { output.destroy(); }
  } finally { font.destroy(); page.destroy(); doc.destroy(); }
}
