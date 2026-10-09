English | [简体中文](licensing.ZH.md)

# Licensing

NAND is MIT (`LICENSE`). Keep it that way: everything that ships in `main.js`, `styles.css` or the helper must be compatible with MIT distribution and properly attributed. This is engineering practice, not legal advice.

## Where attribution lives

| File | Contents | Maintained by |
|---|---|---|
| `LICENSE` | NAND's MIT license, English only | by hand |
| `NOTICE` | works NAND adapts: apex-dashboard and obsidian-dashboard (MIT, the board design), Orca (MIT, with commit mapping), Iconic (MIT-0), obsidian-git (MIT, Git sync); English only | by hand |
| `src/modules/icons/core/res/NOTICE.txt` | Lucide (ISC), Feather-derived icons (MIT), Unicode data and other icon resources | by hand; ships in the banner |
| `docs/third-party/orca-terminal-workbench.md`, `.ZH.md`, `orca-LICENSE.txt` | the pinned Orca commits and what is adapted; the Orca license text | by hand |
| `THIRD-PARTY-NOTICES.md` | every npm package bundled into `main.js` and every crate linked into `nand-pty`, with license texts | `pnpm run notices`; CI runs `check:notices` |
| `main.js` banner | `LICENSE`, `NOTICE`, icon resource notices, Orca license, bundled package licenses | `scripts/esbuild-options.mjs` |

`LICENSE` and `NOTICE` are legal texts and have no `.ZH` companions. `NOTICE` and the other banner files are plain text because they are embedded in a comment at the top of `main.js`.

Release assets attach `LICENSE`, `NOTICE` and `THIRD-PARTY-NOTICES.md`.

## Adding a dependency

1. Check the license. MIT, ISC, BSD, Apache-2.0, MIT-0, CC0, Unicode and Zlib are fine. GPL, AGPL, LGPL (for bundled code), SSPL and "no license" are not; ask first.
2. Prefer a lazy `import()` from the module that needs it; check `pnpm run check:bundle`.
3. Run `pnpm run notices` and commit the regenerated `THIRD-PARTY-NOTICES.md` (the generator refuses unknown or GPL licenses).
4. For Rust crates, use `--locked` builds and rerun `pnpm run notices`.

## Adapting outside code

- Code from an MIT, ISC or BSD project may be adapted: put a header comment naming the source and its upstream commit (`Adapted from Orca (MIT). Copyright (c) 2026 Lovecast Inc.`), add or update the entry in `NOTICE`, and record the file mapping in the third-party document of that upstream (`docs/third-party/`, both languages).
- Keep the upstream's license text. Copyright lines in `NOTICE` and `docs/third-party/orca-LICENSE.txt` are copied from the upstream, not rewritten.
- GPL projects may be studied only for public behavior and user-visible concepts. Do not open their source while writing NAND code, and do not paraphrase it.

## The terminal

The terminal (`src/modules/agent`, `native/pty-server`) is written for NAND and contains no GPL code. It is built from public behavior and documentation:

- Allowed references: Orca (MIT), xterm.js and add-on docs, portable-pty docs, public protocol specs (xterm control sequences, kitty keyboard protocol, win32-input-mode, ConPTY, VS Code shell integration, OSC 7).
- Not allowed: source code of GPL-licensed terminal projects, in any version.

## Similarity check

`scripts/check-similarity.mjs` compares token k-grams (MOSS-style winnowing) of our tree against reference trees and prints only paths and numbers, so it can run against code nobody may read:

```sh
node scripts/check-similarity.mjs --ours src,native/pty-server/src,scripts,test \
  --theirs <reference-dir>[,…] --json <report.json>
```

The tool only reports. Investigate any file whose raw share with a reference file is 0.15 or more, or that has a raw run longer than 40 tokens, and review the top normalized matches by hand (small files, dictionaries and CSS blocks score high structurally). Keep reference trees outside the repository. Run it after large terminal changes and before a release.
