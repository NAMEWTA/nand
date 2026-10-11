---
status: Draft # author
custom: keep
due: 2030-01-02 10:30
remind: true
nandAutomation:
  id: pipeline:note-reminder
  name: Article
  deviceId: device-fixture
  enabled: true
  revision: 1
  schedule:
    kind: once
    at: 1893580200000
  action:
    kind: notify
    body: Article
  channels:
    - in-app
  notifyOn: always
  graceMinutes: 720
  createdAt: 1
  updatedAt: 1
---
# Article
- [ ] Review it
