# CloudBase 部署说明

## 为什么用原生 CloudBase 而不是 AI Works

| 限制 | AI Works | CloudBase 原生 |
|---|---|---|
| 云函数超时 | 约 5 秒，不可配置 | **可配置到 60 秒** |
| 环境变量 | 不支持用户自定义 | **原生支持** |
| 国内访问 | 快 | 快（实测 0.5s） |

本项目调用推理型大模型，实测完整响应约 17 秒，必须要能配置超时。

## 一、准备环境

1. 打开 https://console.cloud.tencent.com/tcb
2. 创建环境，选择**按量计费**（有免费额度）
3. 记下**环境 ID**，形如 `kanshan-xxxxx`

## 二、安装 CLI 并登录

```bash
npm install -g @cloudbase/cli
tcb login
```

浏览器扫码授权即可。

## 三、填写配置

编辑 `cloudbaserc.json`，替换两处：

```json
{
  "envId": "换成你的环境ID",
  "functions": [{
    "envVariables": {
      "ZHIHU_ACCESS_SECRET": "填真实值",
      "MODEL_BASE_URL": "填真实值",
      "MODEL_API_KEY": "填真实值",
      "MODEL_NAME": "deepseek-v4.1-flash-1017"
    }
  }]
}
```

值从 `D:\zhihu\kanshan-companion\.env.local` 复制。

> **安全提醒**：填好真实值后，这个文件就含明文密钥了，不要提交到 Git。
> 仓库里已经有一份占位版本，本地改完不要 push。

## 四、构建

```bash
npm install
npm run build
cp -R .next/static .next/standalone/.next/static
cp -R public .next/standalone/public
```

最后两条命令必须执行，否则线上页面没有样式和图片。

## 五、部署

```bash
tcb fn deploy kanshan-companion --dir . --force
```

首次部署会询问是否创建函数，确认即可。

## 六、验证

部署完成后，控制台会给出访问地址。依次检查：

1. 打开首页 — 应显示「刘看山帮你排计划」
2. 输入目标，点「生成计划」 — 按钮文案会显示实时字数，约 17 秒后出现任务卡片
3. 点任务下方「看看别人在这步踩过什么坑」 — 应出现知乎真实内容
4. 勾选任务 — 进度条变化，右下角刘看山给出反应
5. 刷新页面 — 勾选状态保留

**第 2 步最关键**，它验证了超时配置是否生效。

## 关键参数说明

| 配置项 | 值 | 原因 |
|---|---|---|
| `timeout` | 60 | 实测完整响应 17 秒，留足余量 |
| `memorySize` | 512 | Next.js SSR 的合理下限 |
| `runtime` | Nodejs20.19 | 匹配 package.json engines |
| `installDependency` | false | standalone 已自带精简依赖 |

## 本地验证记录

```
首字节  : 0.10s
总耗时  : 16.9s
正文    : 688 字
表格行  : 8
```

首字节 0.1 秒意味着不会触发任何首字节超时限制；总耗时 17 秒在 60 秒配置内。
