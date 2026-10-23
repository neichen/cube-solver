/*
 * 预计算表包（gzip）：'CLT1' + 头部 JSON 长度（uint32 LE）+ 头部 JSON [{name, type, len, hash}] + 各表原始字节。
 * 浏览器 / Worker：fetch + DecompressionStream('gzip')；每张表都校验长度与 FNV-1a 哈希，任何一步失败都返回 null（调用方回退到现场计算）。
 * Node：encode / decodeBuffer 供构建脚本与测试使用。
 */
(function (root) {
  'use strict';
  var TYPES = { u8: Uint8Array, u16: Uint16Array, u32: Uint32Array, i32: Int32Array };
  function typeOf(a) { return a instanceof Uint8Array ? 'u8' : a instanceof Uint16Array ? 'u16' : a instanceof Uint32Array ? 'u32' : a instanceof Int32Array ? 'i32' : null; }
  function fnv(bytes) { var h = 0x811c9dc5; for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }
  function bytesOf(a) { return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); }
  function encode(tables) {   // {name: TypedArray} → Uint8Array（未压缩）
    var head = [], parts = [], total = 0;
    Object.keys(tables).forEach(function (k) { var a = tables[k], b = bytesOf(a); head.push({ name: k, type: typeOf(a), len: a.length, hash: fnv(b) }); parts.push(b); total += b.length; });
    var hj = new TextEncoder().encode(JSON.stringify(head)), out = new Uint8Array(8 + hj.length + total), o = 8;
    out.set([67, 76, 84, 49]); new DataView(out.buffer).setUint32(4, hj.length, true); out.set(hj, o); o += hj.length;
    parts.forEach(function (b) { out.set(b, o); o += b.length; });
    return out;
  }
  function decode(u8) {
    if (!u8 || u8.length < 8 || u8[0] !== 67 || u8[1] !== 76 || u8[2] !== 84 || u8[3] !== 49) return null;
    var hl = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(4, true), head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl))), o = 8 + hl, out = {};
    for (var i = 0; i < head.length; i++) {
      var h = head[i], T = TYPES[h.type], n = h.len * T.BYTES_PER_ELEMENT;
      if (o + n > u8.length) return null;
      var buf = new Uint8Array(n); buf.set(u8.subarray(o, o + n)); o += n;
      if (fnv(buf) !== h.hash) return null;
      out[h.name] = new T(buf.buffer);
    }
    out._head = head;
    return out;
  }
  function fetchPack(url) {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    // 服务器可能已按 Content-Encoding 解压过：按文件头判断是否还需要 gunzip
    return fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (ab) {
      if (!ab) return null;
      var u = new Uint8Array(ab);
      if (u[0] === 67 && u[1] === 76) return decode(u);
      if (u[0] !== 0x1f || u[1] !== 0x8b || typeof DecompressionStream !== 'function') return null;
      return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(function (b) { return decode(new Uint8Array(b)); });
    }).catch(function () { return null; });
  }
  var api = { encode: encode, decode: decode, fetch: fetchPack, fnv: fnv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CubeLabTablePack = api;
})(typeof self !== 'undefined' ? self : this);
