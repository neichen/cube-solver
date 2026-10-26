/* Share links: js/core/share-code.js round-trips for every puzzle + rejects damaged codes.  node tests/share-code.test.js */
global.self = global; global.window = global; global.CubeLab = {};
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
for (const f of ['js/core/registry.js', 'puzzles/cube3/model.js', 'puzzles/cube3/cube3.js', 'puzzles/nxn/nxn-model.js', 'puzzles/nxn/nxn.js',
  'puzzles/twisty/twisty-model.js', 'puzzles/twisty/twisty.js', 'puzzles/megaminx/megaminx-model.js', 'puzzles/megaminx/megaminx.js'])
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const SC = require(path.join(ROOT, 'js/core/share-code.js'));
const R = require(path.join(ROOT, 'js/seo-routes.js'));
let n = 0;
const lens = {};
for (const id of R.PUZZLES) {
  const P = CubeLab.getPuzzle(id); assert(P, id);
  const solved = P.solvedState();
  const states = [solved];
  for (let k = 0; k < 4; k++) states.push(P.randomState ? P.randomState() : P.apply(solved, P.randomScramble()));
  const holes = solved.slice(); for (let i = 0; i < holes.length; i += 3) holes[i] = null; states.push(holes);
  states.push(solved.map(() => null));
  for (const st of states) {
    const code = SC.encode(P, st);
    assert.deepStrictEqual(SC.decode(P, code), st.map(c => c == null ? null : c), id + ' round trip'); n++;
    assert(/^[A-Za-z0-9_-]+$/.test(code));
  }
  const code = SC.encode(P, states[1]); lens[id] = code.length;
  assert.strictEqual(SC.decode(P, code.slice(1)), null, id + ' short');
  assert.strictEqual(SC.decode(P, code + 'A'), null, id + ' long');
  assert.strictEqual(SC.decode(P, code.slice(0, -1) + '*'), null, id + ' charset');
  assert.strictEqual(SC.decode(P, '_'.repeat(code.length)), null, id + ' out of range');
  assert.strictEqual(SC.decode(P, null), null);
  // hash format
  const h = SC.makeHash({ p: id, s: code, m: 'play', t: 23412 });
  assert.deepStrictEqual(SC.parseHash(h), { p: id, s: code, m: 'play', t: 23410 });
  n += 6;
}
assert.strictEqual(SC.parseHash('#foo'), null);
assert.strictEqual(SC.parseHash('#p=../x&s=AA'), null);
assert.deepStrictEqual(SC.parseHash('#p=cube3&s=AB&t=abc'), { p: 'cube3', s: 'AB', m: 'solve', t: null });
assert.throws(() => SC.encode(CubeLab.getPuzzle('cube3'), ['W']));
console.log('share-code: ' + n + ' checks OK · code lengths ' + JSON.stringify(lens));
