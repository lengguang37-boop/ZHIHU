# 部署说明

## 项目类型

前端 + Node 后端全栈项目（Next.js App Router），**不含数据库写入**，
用户任务状态保存在浏览器 localStorage。符合知乎 AiWorks 的部署适用条件。

## 运行环境

| 项 | 值 |
|---|---|
| Node | >= 20.9.0（已在 package.json engines 声明） |
| 包管理器 | npm |
| 构建命令 | `npm run build` |
| 启动命令 | `npm run start` |
| 监听端口 | 默认 3000，可用 `PORT` 环境变量覆盖 |

## 必须配置的环境变量

部署平台需要在控制台配置以下变量（**不要写进代码或工程包**）：

| 变量名 | 必填 | 说明 |
|---|---|---|
| `ZHIHU_ACCESS_SECRET` | 是 | 知乎开放平台 Access Secret，用于知乎搜索接口 |
| `MODEL_BASE_URL` | 否 | 通用模型服务地址（OpenAI 兼容），如 `https://xxx/v1` |
| `MODEL_API_KEY` | 否 | 通用模型密钥 |
| `MODEL_NAME` | 否 | 通用模型名称 |

**回退逻辑**：三个 `MODEL_*` 变量全部填写时走通用模型；
任一缺失则自动回退到知乎直答（`zhida-fast-1p5`）。
两条通道都用 `ZHIHU_ACCESS_SECRET` 之外的独立凭据，互不影响。

## 本地验证步骤

```bash
npm install
cp .env.example .env.local   # 然后填写真实密钥
npm run build
npm run start
```

打开 http://localhost:3000 验证：

1. 输入一个学习目标，点「生成计划」→ 应出现 5-7 张任务卡片
2. 点卡片下方「看看别人在这步踩过什么坑」→ 应出现知乎真实内容与链接
3. 勾选任务 → 进度条变化，右下角刘看山给出反应
4. 刷新页面 → 勾选状态保留

## 额度与降级

开放平台接口按自然日计额度。本项目已做以下处理：

- 搜索结果进程内缓存 30 分钟，同一关键词不重复请求
- 勾选、刘看山台词等高频交互完全不调用接口
- 接口返回 429 时，页面显示「额度用完了」而非白屏
- 模型未按格式返回表格时，自动降级为列表解析

## 安全

- 所有密钥仅存在于服务端环境变量，不进入前端响应
- `.env.local` 已在 `.gitignore` 中忽略，仓库内只有 `.env.example` 模板
- 工程包打包时需排除 `.env.local`、`node_modules`、`.next`、`.git`
