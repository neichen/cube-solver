#!/usr/bin/env node
/* Tree-shaken three.js bundle for the app: only the classes the app uses, as a classic script that defines the
   global THREE (the app's scripts are plain, non-module scripts). Replaces the deprecated build/three.min.js.
   Run: node tools/build-three.js   (output vendor/three.min.js, committed; three.js is MIT – notice kept on top) */
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const USED = ['AmbientLight', 'BoxGeometry', 'BufferGeometry', 'CanvasTexture', 'DirectionalLight', 'DoubleSide', 'Euler',
  'Float32BufferAttribute', 'FrontSide', 'Group', 'Matrix4', 'Mesh', 'MeshBasicMaterial', 'MeshLambertMaterial',
  'OrthographicCamera', 'PerspectiveCamera', 'PlaneGeometry', 'Quaternion', 'Raycaster', 'REVISION', 'SRGBColorSpace',
  'Scene', 'Shape', 'ShapeGeometry', 'Vector2', 'Vector3', 'WebGLRenderer'];
const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/three/package.json'), 'utf8')).version;
const entry = `export { ${USED.join(', ')} } from 'three';\n`;
require('esbuild').build({
  stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, minify: true, format: 'iife', globalName: 'THREE',
  target: ['es2019'], legalComments: 'none', write: false, treeShaking: true
}).then(r => {
  const banner = `/**\n * three.js r${ver.split('.')[1]} (${ver}) – tree-shaken build (tools/build-three.js): ${USED.length} exports\n * @license\n * Copyright 2010-2023 Three.js Authors\n * SPDX-License-Identifier: MIT\n */\n`;
  const out = banner + r.outputFiles[0].text;
  fs.writeFileSync(path.join(ROOT, 'vendor', 'three.min.js'), out);
  console.log(`build-three: vendor/three.min.js ${(out.length / 1024).toFixed(0)} KB (three ${ver})`);
}).catch(e => { console.error(e); process.exit(1); });
