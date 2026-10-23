// Node 下运行 gullicube WASM（与浏览器 Worker 用同一份 vendor/gullicube 构建）
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '../vendor/gullicube');
function run(n, facelets, opts = {}) {
  const Gullicube = require(path.join(DIR, 'gullicube.js'));
  return new Promise((resolve, reject) => {
    let out = '', si = 0; const t0 = Date.now();
    const args = [String(n), '-f', '-o', '-t', String(opts.threads || 4)].concat(opts.fast ? ['--fast'] : ['--time', String(opts.time || 16)]);
    Gullicube({
      print: s => { out += s + '\n'; }, printErr: () => {},
      stdin: () => si < facelets.length ? facelets.charCodeAt(si++) : null,
      locateFile: f => path.join(DIR, f),
      preRun: [m => { m.FS.mkdir('/data'); for (const f of fs.readdirSync(path.join(DIR, 'data'))) m.FS.writeFile('/data/' + f, fs.readFileSync(path.join(DIR, 'data', f))); }],
      onExit: code => {
        const moves = out.split('\n').filter(l => /^ [^ ]/.test(l)).join(' ').trim().split(/\s+/).filter(Boolean);
        const m = /load ([\d.]+)s/.exec(out);
        code === 0 ? resolve({ moves, ms: Date.now() - t0, loadS: m ? +m[1] : null, log: out }) : reject(new Error('exit ' + code + '\n' + out));
      }
    }).then(mod => mod.callMain(args));
  });
}
module.exports = { run };
