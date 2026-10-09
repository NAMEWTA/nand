=== NAND/自动化/Backup-0-script/操作.md ===
---
nand-type: automation
nand-id: auto-0000-0000-script
id: auto-0000-0000-script
name: Backup
enabled: false
deviceId: device-a
revision: 1
channels:
  - in-app
  - system
notifyOn: always
graceMinutes: 60
createdAt: 1790000000000
updatedAt: 1790000000000
action: script
cwd: ""
shell: bash
schedule: once
at: 2026-10-10T02:00:00.000Z
---

<!-- nand:script -->
echo "backup" | tee log.txt
<!-- /nand:script -->

=== NAND/自动化/Stand up-0-notify/操作.md ===
---
nand-type: automation
nand-id: auto-0000-0000-notify
id: auto-0000-0000-notify
name: Stand up
enabled: true
deviceId: device-b
revision: 1
channels:
  - in-app
notifyOn: never
graceMinutes: 0
createdAt: 1790000000000
updatedAt: 1790000000000
action: notify
schedule: manual
---

<!-- nand:prompt -->
Stretch for five minutes.
<!-- /nand:prompt -->

=== NAND/自动化/每日总结-00-agent/操作.md ===
---
nand-type: automation
nand-id: auto-0000-0000-agent
id: auto-0000-0000-agent
name: 每日总结
enabled: true
deviceId: device-a
revision: 3
channels:
  - in-app
notifyOn: failure
graceMinutes: 720
createdAt: 1790000000000
updatedAt: 1790000500000
action: agent
agentId: claude-code
cwd: ""
sessionMode: fresh
schedule: recurring
repeat: 0 9 * * 1-5
start: 2026-10-01T13:00:00.000Z
timezone: Asia/Shanghai
---

<!-- nand:prompt -->
Summarize yesterday.

- tasks
- notes
<!-- /nand:prompt -->

=== read back ===
{
	"definitions": [
		{
			"name": "每日总结",
			"enabled": true,
			"deviceId": "device-a",
			"revision": 3,
			"graceMinutes": 720,
			"channels": [
				"in-app"
			],
			"notifyOn": "failure",
			"createdAt": 1790000000000,
			"updatedAt": 1790000500000,
			"id": "auto-0000-0000-agent",
			"action": {
				"kind": "agent",
				"agentId": "claude-code",
				"cwd": "",
				"prompt": "Summarize yesterday.\n\n- tasks\n- notes",
				"sessionMode": "fresh"
			},
			"schedule": {
				"kind": "recurring",
				"expression": "0 9 * * 1-5",
				"start": 1790859600000,
				"timezone": "Asia/Shanghai"
			}
		},
		{
			"name": "Backup",
			"enabled": false,
			"deviceId": "device-a",
			"revision": 1,
			"graceMinutes": 60,
			"channels": [
				"in-app",
				"system"
			],
			"notifyOn": "always",
			"createdAt": 1790000000000,
			"updatedAt": 1790000000000,
			"id": "auto-0000-0000-script",
			"action": {
				"kind": "script",
				"script": "echo \"backup\" | tee log.txt",
				"cwd": "",
				"shell": "bash"
			},
			"schedule": {
				"kind": "once",
				"at": 1791597600000
			}
		},
		{
			"name": "Stand up",
			"enabled": true,
			"deviceId": "device-b",
			"revision": 1,
			"graceMinutes": 0,
			"channels": [
				"in-app"
			],
			"notifyOn": "never",
			"createdAt": 1790000000000,
			"updatedAt": 1790000000000,
			"id": "auto-0000-0000-notify",
			"action": {
				"kind": "notify",
				"body": "Stretch for five minutes."
			},
			"schedule": {
				"kind": "manual"
			}
		}
	]
}
