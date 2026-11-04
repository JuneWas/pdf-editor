import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editReducer, initialHistory, type EditObject } from '../lib/edit-state.ts';
const item: EditObject = { id: 'unique', kind: 'text', x: 120, y: 400, width: 100, height: 50, text: '日本語', fontSize: 24, color: '#000000', opacity: 1 };
test('page-isolated edits, undo/redo, branching, and reset', () => {
 const a = editReducer(initialHistory, { type: 'append', page: 1, item });
 const b = editReducer(a, { type: 'append', page: 2, item: { ...item, id: 'second' } });
 const c = editReducer(b, { type: 'set', page: 1, objects: [{ ...item, x: 150 }] });
 assert.equal(c.present[2][0].id, 'second');
 assert.equal(editReducer(c, { type: 'undo' }).present[1][0].x, 120);
 assert.deepEqual(editReducer(editReducer(c, { type: 'undo' }), { type: 'redo' }).present, c.present);
 const branch = editReducer(editReducer(c, { type: 'undo' }), { type: 'set', page: 1, objects: [] });
 assert.equal(branch.future.length, 0);
 assert.equal(branch.present[2].length, 1);
 assert.deepEqual(editReducer(branch, { type: 'reset' }), initialHistory);
 assert.equal(initialHistory.present[1], undefined);
});
