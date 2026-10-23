# gullicube (WebAssembly build) — notice

* Upstream: https://github.com/rokicki/gullicube (Tomas Rokicki), commit
  `48bd54b36a95888639f63df63a24d8639b84cd23` (2026-10-21).
* gullicube is dual-licensed (GPL / MPL-2.0). **This project uses it under the
  Mozilla Public License 2.0** — see `LICENSE-MPL.md` in this directory.
* **Modified files: none.** The C++ sources were compiled unchanged with
  Emscripten 6.0.13. The only additions are build flags (see below) and our own
  adapter `puzzles/nxn/gullicube.worker.js`, which feeds the facelet string on
  stdin and reads the solution from stdout. The adapter is our own code and not
  part of gullicube.
* `data/*.cls` are the unmodified table files from the upstream `data/`
  directory (only the files the solver loads are shipped).
* Source code for the MPL-covered files is available at the upstream URL and
  commit above.

Build flags:

```
em++ -O3 -pthread  (all upstream src/full/*.cpp and src/brob/*.cpp)
 -sPROXY_TO_PTHREAD -sALLOW_MEMORY_GROWTH -sMAXIMUM_MEMORY=4GB -sINITIAL_MEMORY=128MB
 -sMODULARIZE -sEXPORT_NAME=Gullicube -sINVOKE_RUN=0 -sEXIT_RUNTIME=1
 -sEXPORTED_RUNTIME_METHODS=callMain,FS,ENV -sENVIRONMENT=worker,node
 -sSTACK_SIZE=8MB -sDEFAULT_PTHREAD_STACK_SIZE=2MB -sPTHREAD_POOL_SIZE=0
```

Multi-threaded WebAssembly needs a cross-origin isolated page
(`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy:
require-corp`), see `deploy/_headers`.
