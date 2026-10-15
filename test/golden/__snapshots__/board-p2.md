---
columns:
  - name: Feeds
    type: rss
    rss:
      feeds:
        - name: News
          url: https://example.com/rss
          group: Tech
      downloadFolder: NAND/RSS
      groups:
        - Tech
      groupBy: feed
      pageSize: 50
  - name: Books
    type: weread
    weread:
      widgets:
        - id: shelf
          view: shelf
          progressFilters:
            - reading
        - id: stats
          view: stats
          statsItems:
            - trend
            - kpi
        - id: notes
          view: notes
  - name: Tasks
    type: ticktick
    ticktick:
      view: lists
      hiddenProjects:
        - archive
      projectWidths:
        inbox: 320
---
## Feeds

## Books

## Tasks
