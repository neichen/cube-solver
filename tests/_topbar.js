/* Shared helpers for the icon menus that replaced the two top-bar <select>s. */
async function pickPuzzle(p, id) {
  if (typeof id === 'object') id = await p.evaluate(i => document.querySelectorAll('#puzzleMenu [data-pid]')[i].dataset.pid, id.index);
  await p.click('#puzzleBtn'); await p.click('#puzzleMenu a[data-pid="' + id + '"]');
}
async function pickLang(p, code) { await p.click('#langBtn'); await p.click('#langMenu a[data-lang="' + code + '"]'); }
module.exports = { pickPuzzle, pickLang };
