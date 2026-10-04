# 附件核心的本地验证范围

本记录仅覆盖本分支的独立核心文件，不证明整个插件已构建或所有功能已迁移。

## 执行环境与命令

Node 22.16.0，TypeScript 5.8.3；Linux 容器。测试使用项目现有的 `register-ts-hooks.mjs` 与 `resolve-ts-hooks.mjs`，并未新增测试框架。包管理器、仓库全量依赖及 Obsidian 宿主在本地检查环境中不可用。

```sh
# 生产核心文件的独立类型检查
node /opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/bin/tsc \
  --noEmit --target ES6 --module ESNext --moduleResolution node \
  --lib DOM,ESNext --strict --noUncheckedIndexedAccess --noImplicitReturns \
  --noUnusedLocals --noUnusedParameters \
  src/core/attachments/model.ts src/core/attachments/naming.ts \
  src/core/attachments/path-policy.ts src/core/attachments/markdown-link.ts \
  src/core/attachments/import-service.ts src/core/attachments/organization.ts

# 同一套独立测试，按下表三个 TZ 分别执行
TZ=UTC node --experimental-strip-types --import ./scripts/register-ts-hooks.mjs \
  --test src/core/attachments/attachments.test.ts
```

| 检查 | 结果 | 适用范围 |
|---|---|---|
| 独立严格 TypeScript 检查 | 退出码 0 | 六个生产核心文件，不包含整个仓库 |
| TZ=UTC | 56 通过，0 失败，0 跳过 | 内存端口和纯规则 |
| TZ=America/New_York | 56 通过，0 失败，0 跳过 | 同一套用例的时区变体 |
| TZ=Asia/Shanghai | 56 通过，0 失败，0 跳过 | 同一套用例的时区变体 |

覆盖路径优先级、三种布局、Vault 内父目录、非法／保留目录、时间捕获、可选名称、Unicode 与长度、冲突序号、Markdown 转义、逐项读写错误、队列快照、20 批次并发、取消／停机、跨实例隔离和共享引用决策。256 个 Unicode 输入组成一个生成式测试，不是 256 个独立测试条目。

未执行整库 `pnpm build`、`pnpm lint`、`pnpm test:all` 或 Obsidian 实机验证。未重建 `main.js`；新增核心尚未被生产入口引用，不能据此宣称已交付可用功能。提交后原有 CI 仍应验证产物一致性，不能删除或跳过该检查。

## 被测文件 SHA-256

| 文件 | SHA-256 |
|---|---|
| `src/core/attachments/attachments.test.ts` | `4f3fc1c19afcd0985cc759aa409ac5a614e4cc565d93d5ba68452cf61443f62c` |
| `src/core/attachments/import-service.ts` | `ee824b3f4271c7379a9c83cdc8d5d6f339f645d8610caea5969746c16468e4d4` |
| `src/core/attachments/markdown-link.ts` | `0889b94589689f90a9df22f4bdb86a3285487762c08eae26d9c2a7904219b8e1` |
| `src/core/attachments/model.ts` | `0a2aca992d70376bfbbf4520688a9de5e61fc7863d092f39f78fa7617fff2814` |
| `src/core/attachments/naming.ts` | `3a734f50dba9c14613bc43a9403704a1d67948adfa8b21795dd26ff00102763b` |
| `src/core/attachments/organization.ts` | `874ad855b6cba884740795f1cf56f370b4b2eda3df19268de5d3fb29a27b2896` |
| `src/core/attachments/path-policy.ts` | `b8ee58578c5101af68372d6c73e48e7bb25a46150163d306d30239ed23172898` |

哈希对应上述命令执行的源文件；后续修改必须重跑检查并更新本记录，不能沿用旧结果。
