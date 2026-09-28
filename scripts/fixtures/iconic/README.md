# Fixed upstream oracle

`upstream-1.1.10.json` was generated from the original `gfxholo/iconic` sources at `268e133c6f99dcef670cbda0d25a74b8239aa099`, not from NAND's migrated RuleManager.

The original RuleManager and ObsidianUtils were bundled with esbuild and a minimal Obsidian TFile stub. A prototype instance received the fixture's file, metadata and timestamps plus the original IconicPlugin.splitFilePath implementation. Each case was evaluated with `TZ=UTC`, the fixed `now`, and Obsidian's String.isString / Number.isNumber / isBoolean helpers. Missing rule fields use enabled=true, match=all and null icon/color. The 137 boolean outputs are committed so a future port edit cannot redefine its own expected results.

Defaults and command IDs were extracted from the original IconicPlugin; locales were flattened directly from upstream i18n/en.json and zh.json. Resource hashes are SHA-256 of the original resource file bytes. Tests never download upstream at runtime.

To update the oracle, first choose and record a new upstream commit, rerun the original implementation against the same inputs, and review changed outputs as a deliberate behavior change. Do not regenerate expectations from the NAND core/icons or platform/obsidian/icons implementation.
