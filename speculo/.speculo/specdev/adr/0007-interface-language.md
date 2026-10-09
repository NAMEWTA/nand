English | [简体中文](0007-interface-language.ZH.md)

# ADR-0007: Interface language and dictionaries

Status: accepted. Checked against the code on 2026-10-08.

## Problem

NAND is used in Chinese and English. A language preference belongs to the plugin, not to a feature that can be switched off. Dictionaries for features users may never enable should not be paid for at startup.

## Decision

- **One preference.** The `language` field of the `app` settings namespace is `zh` or `en`. A new vault gets Chinese when Obsidian's interface is Chinese and English otherwise; an invalid stored value falls back to that default. The preference is changed in the workbench under Settings, General, Language. It does not depend on any module being on.
- **Publishing a change.** Language changes are written one after another, and the new language is published to subscribers only after the write succeeds. A failed write keeps the old language. A published change refreshes the localized text in every open window, including popout windows.
- **Every string has two languages.** User-facing text goes through `t(key, params)`, and every key exists in both `en` and `zh` with the same placeholders. Missing keys fall back to English, then to the key.
- **Where dictionaries live.** Dictionaries holding keys that startup code reads are in `src/shared/i18n/` and are merged at startup. Each module has its own `i18n.ts`, registered with `registerMessages` when its `module.ts` loads. Dictionaries shared by several modules are in `src/shared/i18n/lazy/`.
- **Content is not translated.** User notes, paths, ids and the original text of imported material stay as they are.
- **Checked by a script.** `scripts/verify-i18n.mjs` fails on a key that exists in one language only, on placeholder mismatches and on `t()` calls with a literal key that no dictionary defines.

## Consequences

Switching a module off removes its dictionary cost from startup. Adding a language means adding a field to every dictionary, which the check enforces.

## Evidence

[Runtime](../../../../src/shared/i18n/runtime.ts), [app schema](../../../../src/app/settings/app-schema.ts), [language handling](../../../../src/app/settings/language.ts), [i18n check](../../../../scripts/verify-i18n.mjs). `pnpm test:i18n`; the language tests (`src/app/settings/language.test.ts`).
