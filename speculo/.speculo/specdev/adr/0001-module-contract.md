English | [简体中文](0001-module-contract.ZH.md)

# ADR-0001: Module contract and registry

Status: accepted. Checked against the code on 2026-10-08.

## Problem

NAND ships nine features with different cost, platform support and failure modes. Each must start and stop on its own, leave nothing behind when it stops, and fail without taking the plugin down. Features also need to cooperate without importing each other.

## Decision

**Zones.** Source is divided into `app` (composition root, loaded at startup), `shell` (workbench UI), `ui` (design system), `theme`, `host` (Obsidian and desktop adapters), `shared` (pure utilities, settings store, storage, i18n runtime) and `modules/<id>`. A module has `manifest.ts`, `api.ts`, `module.ts`, `settings.ts` and `i18n.ts` at its root, and the folders `core` (domain rules, no host packages), `platform` (vault and desktop IO; Node and Electron only under `desktop/`), `services`, `contrib` and `ui`.

**Import direction.** An import matrix decides what each zone may import. `scripts/verify-architecture.mjs` enforces it for value and type imports, literal `import()`, runtime cycles and barrel imports. It also rejects host packages and host globals in `core` and `shared`, and Node, Electron and `window.require` outside `desktop/` folders. Any violation fails; there is no baseline. A module reaches another module only through that module's `api.ts`.

**Manifest.** Each module has a data-only `ModuleManifest`: id, order, icon, title and description keys, supported platforms, `defaultEnabled`, an activation time (`startup`, `layout-ready` or `on-demand`), the services it provides, the contribution points it contributes to, and `load()`, the only edge into its code. `src/app/manifests.ts` lists all manifests.

**Registry.** `ModuleRegistry` creates a module when its switch in the `app` settings namespace is on and the platform is supported. A module moves through `off` or `unsupported`, `idle`, `loading`, `active` and `disposing`, or is `failed`. Modules enable in manifest order and disable in reverse order. A module that throws while loading, activating or disposing is marked failed and reported; the others continue, and the next apply retries it. Transitions of one module are serialized.

**Context.** A module receives a `ModuleContext`: its id, the app, the plugin manifest, the environment, a `lifetime`, the settings store, services, contributions, shell access, commands and editor access. It never receives the plugin instance. Whatever it registers through `lifetime`, `commands` and `editor` is removed when it is disposed, so turning a module off leaves no listener, command, editor extension, body class or process behind.

**Cooperation.** Modules cooperate through services and contribution points declared in the owner's `api.ts` with `serviceKey` and `contributionPoint`. `peek` returns a service only if its owner is active and never activates it. `acquire` activates the owner and returns a lease whose `revoked` signal aborts when the owner stops. `watch` follows availability. Examples are the automation sources contributed by `home` and `archives`, and the notification openers contributed by `automations`.

## Consequences

A feature can be turned off and on again at runtime. Adding a module means a manifest, a `module.ts` and, if it exposes anything, an `api.ts`. The price is ports and composition code instead of direct calls.

## Evidence

[Module contract](../../../../src/app/contracts/module.ts), [registry](../../../../src/app/modules/registry.ts), [manifest list](../../../../src/app/manifests.ts), [architecture check](../../../../scripts/verify-architecture.mjs). `pnpm test:architecture`; the registry tests, which inject load, activate and dispose failures; the module-switch checks of the real-Obsidian probe.
