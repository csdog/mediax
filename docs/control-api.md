# 本机 Agent 控制面

MediaX 启动进入 Eventually 后，主进程 Hono 服务监听 `127.0.0.1`，连接信息写到 `~/.mediax/agent/control.json`（权限 0600，退出删除）。CLI 与桌面共用账号服务、PublishService 和发布队列；不是独立的云发布通道。开发版本需同时使用对应的桌面和 [mediax-agent](https://github.com/csdog/mediax-agent) 源码。

`GET /doc` 提供 OpenAPI 3.0 JSON，无需认证；其余接口必须带 `Authorization: Bearer <token>`。配置仍为 `apiVersion: 1`，新增业务路径为兼容扩展。

## 接口

- `GET /health`：健康与桌面版本。
- `GET /accounts`：本地账号状态、已验证发布身份及 `supportedKinds`。
- `POST /accounts/{id}/refresh`：重新检查账号状态与身份，可能打开账号页面。
- `GET /tasks`：全部发布任务及目标状态。
- `GET /tasks/{id}`：一个任务和它的目标。
- `POST /tasks`：创建立即或定时发布任务，返回 201 和任务、目标；仅代表创建成功，最终结果应查询目标状态。
- `PATCH /tasks/{id}/schedule`：改期，body 为 `{ "scheduledAt": "2099-01-01T08:00:00+08:00" }`；只允许全部目标仍处于 `scheduled` 的任务。
- `GET /calendar?from=...&to=...`：按时间范围查询日历（含开始、不含结束），时间需带时区。
- `POST /targets/{id}/retry`：仅重试明确失败目标。
- `POST /targets/{id}/resume`：人工处理后继续等待中的目标。
- `POST /targets/{id}/verify`：核验已提交或结果未知的目标，不重新发布。

`POST /tasks` 的 JSON：

```json
{
  "kind": "moment",
  "body": "发布正文",
  "paths": ["/absolute/path/image.png"],
  "targets": [{ "accountId": "从 accounts 获取", "identityId": "1", "kind": "profile" }],
  "scheduledAt": "2099-01-01T08:00:00+08:00"
}
```

内容类型为 `article | moment | video | audio`；文章还需 `title`。素材是本机绝对路径，桌面校验格式和大小后复制到任务目录。省略 `scheduledAt` 或传 `null` 会立即执行发布；传定时时间必须晚于当前时间。身份名称由账号服务解析，不接受调用者自报身份名。业务验证与桌面编辑器相同。

参数错误返回 400，认证失败 401，不存在 404，业务拒绝 409，请求超过 1 MiB 返回 413，服务未就绪 503。错误 JSON 为 `{ "error": { "code": "...", "message": "可读提示" } }`。

排期仅在桌面运行时推进。验证码、登录和身份歧义仍须人工处理。调用超时或断线后先查询任务记录，不自动重复创建任务；当前创建接口不提供幂等键。草稿编辑、删除排期、批次差异文案和 MCP 不属于本次接口。

## CLI

```sh
mediax-cli doctor --json
mediax-cli accounts list --json
mediax-cli accounts refresh ACCOUNT_ID --json
mediax-cli publish --file publish.json --json
mediax-cli tasks list --json
mediax-cli tasks get TASK_ID --json
mediax-cli tasks reschedule TASK_ID --at '2099-01-01T08:00:00+08:00' --json
mediax-cli calendar --from '2099-01-01T00:00:00+08:00' --to '2099-02-01T00:00:00+08:00' --json
mediax-cli tasks retry TARGET_ID --json
mediax-cli tasks resume TARGET_ID --json
mediax-cli tasks verify TARGET_ID --json
```

`tasks retry/resume/verify` 参数是目标 ID，不是任务 ID。JSON 输出包含 `ok/action/version/data`，失败额外包含 `error.message` 并退出 1。CLI 通过桌面 OpenAPI 生成客户端，不直接改 SQLite。
