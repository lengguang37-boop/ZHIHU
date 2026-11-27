# 刘看山帮你排计划

说一个目标，AI 拆成今天就能动手的小任务，每一步挂上知乎上真实踩过坑的人的经验。

知乎黑客松 S3「湾区共创季」· AI × 陪伴与交互 赛道参赛作品。

**线上 Demo**：https://liukanshan-qgmzb-d8e3cj85b0c366f-1543318947.ap-shanghai.app.tcloudbase.com/

---

## 这个项目在做什么

大多数 AI 规划工具给你一份"看起来很专业"的计划，然后你关掉页面再也不会打开。

这里反着做两件事：

1. **任务小到今天就能做** —— 不说"学习运球技巧"，说"找一面墙，右手原地拍球 200 次，再换左手 200 次，全程眼睛看前方不看球"。带时长，能打勾。
2. **每一步挂真实经验** —— 每个任务下面有个「看看别人在这步踩过什么坑」，点开是知乎上真人在这个问题下的回答，不是模型编的。

刘看山在旁边陪着，你打勾他会说话。全勾完了，他比你还高兴。

---

## 本地跑起来

### 环境要求

- Node.js 20 或更高（`node -v` 检查）
- 一个知乎开放平台账号

### 三步启动

```bash
# 1. 装依赖
npm install

# 2. 配置凭据
cp .env.example .env.local
# 然后编辑 .env.local，填入你的 ZHIHU_ACCESS_SECRET

# 3. 启动
npm run dev
```

打开 http://localhost:3000

### 凭据怎么拿

| 变量 | 必填 | 说明 |
|---|---|---|
| `ZHIHU_ACCESS_SECRET` | 是 | 到 [知乎开放平台](https://developer.zhihu.com/) 控制台创建应用后获取 |
| `MODEL_BASE_URL` | 否 | 通用模型服务地址，留空则回退知乎直答 |
| `MODEL_API_KEY` | 否 | 通用模型密钥 |
| `MODEL_NAME` | 否 | 模型名，默认 `deepseek-v4.1-flash-1017` |

> **关于直答额度**：知乎直答免费版只有 **2 次/天**，开发时会很快用完。建议配置一个通用模型，否则调试一次就没额度了。

---

## 项目结构

```
app/
  page.tsx              主页面：输入目标、任务卡片、进度、知乎经验挂载
  layout.tsx            全局布局与 metadata
  globals.css           全局样式、动画、prefers-reduced-motion 适配
  api/
    chat/route.ts       规划接口，SSE 流式返回
    search/route.ts     知乎搜索，进程内缓存 30 分钟

components/
  Kanshan.tsx           右下角刘看山立绘与气泡，四种情绪

lib/
  plan-parser.ts        从模型输出里解析任务表格
  reactions.ts          刘看山的台词库与情绪判定
```

### 两个关键实现

**流式返回**：`app/api/chat/route.ts` 一进来就吐出 SSE 首字节，再在流内部 `await fetch` 模型，逐块转发。这样前端立刻能看到"规划中 xx 字…"在跳，用户不会以为卡死。

**解析放在前端**：模型输出是流式的，等到后端全部收完再解析，用户就得干等 30 秒。所以后端只负责透传，`lib/plan-parser.ts` 在前端边收边累加，收完再切表格。

---

## 部署

见 [DEPLOY-CLOUDBASE.md](./DEPLOY-CLOUDBASE.md)。

要点：`output: 'standalone'` 构建后需手动把 `.next/static` 和 `public` 复制进 `.next/standalone/`，然后整个目录作为函数代码上传。HTTP 访问服务必须挂在**根路径 `/`**，否则 HTML 里的 `/_next/*` 绝对路径会 404，页面变成裸 HTML。

---

## 技术栈

Next.js 16（App Router + Turbopack）· React 19 · TypeScript · Tailwind CSS v4

---

## 许可

仅用于知乎黑客松 S3 参赛与学习交流。
