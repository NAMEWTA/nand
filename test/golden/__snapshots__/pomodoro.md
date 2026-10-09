=== NAND/番茄钟/活动.md ===
---
nand-type: pomodoro-settings
nand-id: pomodoro-settings
currentActivity: 写作
tags:
  - name: 写作
    pinned: true
  - name: Review
    pinned: false
---

=== NAND/番茄钟/记录/2026/2026-10-02.md ===
---
nand-type: pomodoro-records
nand-id: pomodoro:2026-10-02
date: 2026-10-02
completed: 2
---

<!-- nand:records -->
| id | timestamp | activity | duration | interruptions | breakMinutes | breakCompleted |
| --- | --- | --- | --- | --- | --- | --- |
| "2026-10-02T09:00:00.000Z" | "2026-10-02T09:00:00.000Z" | "写作" | 25 | 1 | 5 | true |
| "2026-10-02T10:00:00.000Z" | "2026-10-02T10:00:00.000Z" | "Review" | 20 | null | null | null |
<!-- /nand:records -->

=== read back ===
{
	"version": 2,
	"currentActivity": "写作",
	"tags": [
		{
			"name": "写作",
			"pinned": true
		},
		{
			"name": "Review",
			"pinned": false
		}
	],
	"sessions": [
		{
			"date": "2026-10-02",
			"completed": 2,
			"records": [
				{
					"timestamp": "2026-10-02T09:00:00.000Z",
					"activity": "写作",
					"duration": 25,
					"interruptions": 1,
					"breakMinutes": 5,
					"breakCompleted": true
				},
				{
					"timestamp": "2026-10-02T10:00:00.000Z",
					"activity": "Review",
					"duration": 20
				}
			]
		}
	]
}
