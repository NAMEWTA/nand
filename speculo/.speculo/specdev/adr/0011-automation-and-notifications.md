English | [简体中文](0011-automation-and-notifications.ZH.md)

# ADR-0011: Device-owned automation runs and independent notification receipts

Status: accepted. Checked against the code on 2026-10-08.

## Problem

A vault can be open on several devices, and Obsidian can close at any time. Automations run actions with external effects: they start agents and scripts, open pages and send notifications. Such an effect must not repeat because a timer fired twice, a device restarted, a vault was synced or an inbox was cleaned.

## Decision

**Definitions are Markdown.** A standalone definition is a Markdown document with a stable id under `NAND/自动化/`. Definitions owned by a product stay in that product's documents: board todos and widgets (`home`) and archive reminders (`archives`). Those modules contribute an `AutomationSource` to `automations.sources`, which lists, saves and opens their definitions. The action kinds are `script`, `agent`, `obsidian-command`, `open-file`, `open-url`, `notify` and `create-task`. A schedule is `manual`, `once` or `recurring`; a recurring schedule can carry its time zone, and a definition has a grace period for late starts.

**A definition belongs to a device.** Each definition has an executing device id taken from the machine. Copying or syncing the vault does not move it. Runtime state is per device: `.nand/automation/<device-id>/runtime.json` holds schedule cursors and run records.

**Intent is persisted first.** A run is written as `pending` before its action starts. After a restart, a run that was still pending or running becomes `interrupted`. NAND does not replay it. A scheduled run that is later than its grace period is skipped. Manual definitions never enter the schedule queue. State transitions are serialized and published to the interface only after they are persisted. The statuses are `pending`, `running`, `unknown`, `succeeded`, `failed`, `cancelled`, `interrupted` and `skipped`.

**Sources are indexed by events.** Scheduling reads an in-memory index of definitions that changes with vault events; it does not reread the vault on a timer. Timers and vault listeners belong to the module lifetime, so turning the module off stops them and stops or interrupts owned runs.

**The runtime port is separate.** Agent and script actions run through `agent.automation-runtime`, which the agent module provides on desktop. Without it the actions report that they are unavailable.

**Notifications keep receipts apart.** The inbox stores visible messages and, separately, delivery receipts keyed by the request id. A request whose id already has a receipt is ignored, so hiding or trimming messages cannot cause a second delivery. A delivery that was `pending` when the plugin stopped is loaded as `unknown` and is never retried automatically. The channels are `in-app` and `system`; the system channel depends on the operating system's permission. A notification failure does not change the native result of the run it reports. On stop, the service first refuses new requests and then finishes the persistence it accepted. The inbox is per device: `.nand/notifications/<device-id>/inbox.json`.

**Openers are contributed.** A module that sends a kind of notification contributes an opener to `notifications.openers`. The automations module contributes the opener that opens a run or its source.

## Consequences

NAND gives at-most-once treatment to external effects, not exactly-once: a run interrupted by a closing host is reported, not repeated. Nothing runs while Obsidian is closed.

## Evidence

[Automation service](../../../../src/modules/automations/core/service.ts), [definitions](../../../../src/modules/automations/core/documents.ts), [runtime](../../../../src/modules/automations/services/runtime.ts), [automation api](../../../../src/modules/automations/api.ts), [notification service](../../../../src/modules/notifications/core/service.ts), [notification api](../../../../src/modules/notifications/api.ts). The automation and notification suites (`pnpm test`) and `pnpm run test:safety-regressions`.
