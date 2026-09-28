# T-01：配套终端服务发行（进行中）

## 1. 执行摘要

本地实现和最终候选已验证，尚未公开发布；AC-001/002 partial，不能标done。原始候选/red/集成记录保留在T-01-initial-local-candidate.md及implementation/，后续其它15票已完成。

## 2. Lead Dispatch And Candidate Return

current/main唯一Lead。初始实现e7c59b2e87a858725874d53530bdacb72918f5ca，parent09aade655241fff439d3147a55ec1448a4f93eea。最终生产候选096c853fb2e08699603f79fef011895b9b9c1703，parentd1e5c89963f31c8ef6aca4b50ee82b968652377e；最后提交仅补README/CHANGELOG发行说明，在本票原写集内。没有子代理或远程写入。

## 3. 实现与合同

版本0.0.2、tag/manifest/package/versions校验，release.yml调用同commit五平台native build/test；五binary+SHA256完整性验证与打包Linux PTY/历史检查先于公开release。旧版0.0.1缓存拒绝、匹配版本和篡改检查已由binary-downloader测试覆盖。未增加旧服务兼容协议。

最终本地zip重新包含全量修复后的main.js/manifest/styles，摘要见release-candidate.json；Linux本地服务重新构建及测试通过。其余四平台尚无本次CI结果，本地zip和Linux服务不冒充公开发行资产。

## 4. 验收与合同映射

| AC | 已成立 | 尚未成立 |
|---|---|---|
| AC-001 | 版本变化选择新服务、同提交workflow、版本/五平台完整性gate代码及本地版本验证 | 五平台CI实际绿灯、公开tag/Release和升级默认下载 |
| AC-002 | Linux本地PTY/历史协议回路、退出/进程树清理、只读原生记录；隔离Obsidian中多票真实历史/导出/状态/生命周期验证 | 全新Vault和全新配置目录从公开0.0.2默认下载后的首次启动及完整流程 |

## 5. Workspace Verification

current-workspace /srv/nand。最终全量代码的测试汇总见父evidence/aggregate-verification.md；Rust29/29、PTY/history集成、build、lint（0 errors/157既有warnings）在release-candidate/。Obsidian1.13.7隔离GUI可用，之前“没有Obsidian”的环境限制已解除；尚未进行的是新公开资产的默认下载验收。

## 6. 双轴审查

标准轴：发布只能由现有release.yml生成，同tag五平台资产必须齐全并核验SHA256；候选没有旧协议兼容分支。规范轴：公开安装是剩余合同的实际入口，不能以本地替换binary或既有合成Vault验收宣称完成。

## 7. Integration Verification

初始实现与最终候选均为非空本地提交。初始10个文件、最终2个发行说明文件均在写集。其它15票的result/direct-parent/scope/ancestor已独立核验。当前票required公开E2E未通过，integration不伪标完整passed。

## 8. 下一步具体动作

待明确授权：推送main至NAMEWTA/nand；为096c853fb2e08699603f79fef011895b9b9c1703创建并推送不带v前缀的0.0.2标签；由release.yml构建/测试Linux x64/arm64、macOS x64/arm64、Windows x64并公开Release，附zip及10个binary/checksum资产。之后全新隔离配置/库走默认GitHub下载，检查首次PTY、历史/未知用量、可见导出、合成CLI恢复、重启、模块关闭和进程清理。不得改写旧tag，不评论或关闭issue。

## 9. 残余风险与交付定位

#37仍in_progress；父Goal为34/36AC通过，尚余本票公开发行合同。未运行macOS/Windows实际GUI或六家真实账号，所有现有LinuxGUI数据和CLI均为合成夹具。

## Skill Execution Records

dev绑定SHA256=f9da74f9f81825387ff53292e09b7d032b2696cd33a9586a3e736044299be7e7。已按其build-and-release参考执行版本、同提交发行、Linux服务与bundle规则；该参考“Push main, then push the tag. That workflow is the only release creator.”约束待授权动作。最终需要标准JSON执行记录及required公开E2E后才能完成票。
