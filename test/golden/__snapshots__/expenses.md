=== NAND/记账/分类.md ===
---
nand-type: expense-settings
nand-id: expense-settings
version: 1
lastCategory:
  expense: food
  income: salary
customCategories:
  expense:
    - 咖啡
categoryOrder:
  expense:
    - 咖啡
    - food
primaryCategories:
  expense:
    - 日常
categoryParents:
  expense:
    咖啡: 日常
    food: 日常
---

=== NAND/记账/记录/2026/2026-10-01.md ===
---
nand-type: expense-records
nand-id: expense:2026-10-01
date: 2026-10-01
---

<!-- nand:records -->
| id | type | amount | category | note | date | createdAt |
| --- | --- | --- | --- | --- | --- | --- |
| "exp-1" | "expense" | 32.5 | "food" | "午饭 \u007c 同事" | "2026-10-01" | 1790000000000 |
| "exp-2" | "income" | 1200 | "salary" | null | "2026-10-01" | 1790000100000 |
<!-- /nand:records -->

=== NAND/记账/记录/2026/2026-10-03.md ===
---
nand-type: expense-records
nand-id: expense:2026-10-03
date: 2026-10-03
---

<!-- nand:records -->
| id | type | amount | category | date | createdAt |
| --- | --- | --- | --- | --- | --- |
| "exp-3" | "expense" | 8 | "咖啡" | "2026-10-03" | 1790200000000 |
<!-- /nand:records -->

=== read back ===
{
	"version": 1,
	"records": [
		{
			"id": "exp-1",
			"type": "expense",
			"amount": 32.5,
			"category": "food",
			"note": "午饭 | 同事",
			"date": "2026-10-01",
			"createdAt": 1790000000000
		},
		{
			"id": "exp-2",
			"type": "income",
			"amount": 1200,
			"category": "salary",
			"date": "2026-10-01",
			"createdAt": 1790000100000
		},
		{
			"id": "exp-3",
			"type": "expense",
			"amount": 8,
			"category": "咖啡",
			"date": "2026-10-03",
			"createdAt": 1790200000000
		}
	],
	"lastCategory": {
		"expense": "food",
		"income": "salary"
	},
	"customCategories": {
		"expense": [
			"咖啡"
		]
	},
	"categoryOrder": {
		"expense": [
			"咖啡",
			"food"
		]
	},
	"primaryCategories": {
		"expense": [
			"日常"
		]
	},
	"categoryParents": {
		"expense": {
			"咖啡": "日常",
			"food": "日常"
		}
	}
}
