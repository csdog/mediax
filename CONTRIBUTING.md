# Contributing

感谢关注 MediaX。本仓目前为私有维护；若你有权限提交改动，请按下面约定。

## 本地开发

见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)（mise / pnpm、测试、打包）。

## 提改动

1. 在功能分支上开发，不要把发版相关改动只直推 `main`。
2. 开 PR → Review → **merge 进 `main`**。
3. 对用户可见的实质变化，**同一批提交**抬 `package.json` 的 `version`（semver）。
4. 发版：在已合并的 `main` 上打并推送与 version 一致的 `v*` 标签，触发安装包与 GitHub Release。

GitHub Release 的自动 What's Changed 只汇总合并进默认分支的 **PR**。

## 写代码时

给自动化助手 / Agent 的详细约定见 [AGENTS.md](AGENTS.md)（代码位置、发布约束、性能、测试边界等）。人审 PR 时也可对照同一份。

## 不要做的事

- 不要为了验证向真实账号再发一条帖。
- 集成 / 打包测试（`test:integration`、`test:packaged`）仅在明确需要时运行。
- 日志与诊断里不要写入正文、Cookie、密码。
