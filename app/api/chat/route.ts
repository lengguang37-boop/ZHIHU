const PLANNER_PROMPT = `你是一个任务规划器，只输出一张 Markdown 表格，不输出任何其他文字。

严格格式（4 列，表头必须完全一致）：
| 序号 | 任务 | 预计耗时 | 为什么这步重要 |
| --- | --- | --- | --- |
| 1 | 具体动作 | 1 小时 | 新手常见的坑 |

硬性要求：
1. 只输出这张表格。表格之前不要写标题、结论、前言；表格之后不要写总结、鼓励、备注。
2. 5-7 行数据。
3. 「任务」列必须是一个可以直接动手的具体动作，不要写"理解某某概念"这类无法执行的内容。
4. 「为什么这步重要」写新手在这一步最容易踩的坑，20-40 字。
5. 不要使用 markdown 标题、列表、加粗。`

type Task = {
  id: number
  title: string
  estimate: string
  why: string
  done: boolean
}

/** 通用模型通道：环境变量齐全时启用 */
function useCustomModel() {
  return Boolean(
    process.env.MODEL_BASE_URL &&
      process.env.MODEL_API_KEY &&
      process.env.MODEL_NAME
  )
}

/** 调通用模型（OpenAI 兼容格式） */
async function callCustomModel(goal: string) {
  const base = process.env.MODEL_BASE_URL!.replace(/\/+$/, '')
  const url = base.endsWith('/chat/completions')
    ? base
    : `${base}/chat/completions`

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MODEL_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.MODEL_NAME,
      stream: false,
      temperature: 0.3,
      messages: [
        { role: 'system', content: PLANNER_PROMPT },
        { role: 'user', content: goal },
      ],
    }),
  })
}

/** 调知乎直答 */
async function callZhihu(goal: string) {
  return fetch('https://developer.zhihu.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ZHIHU_ACCESS_SECRET}`,
      'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body: JSON.stringify({
      model: 'zhida-fast-1p5',
      stream: false,
      messages: [
        { role: 'system', content: PLANNER_PROMPT },
        { role: 'user', content: goal },
      ],
    }),
  })
}

/** 优先解析表格 */
function parseTable(md: string): Task[] {
  const rows = md
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0)
    )
    .filter((cols) => cols.length >= 3)
    .filter((cols) => !/^[-:\s]+$/.test(cols[0]))
    .filter((cols) => !/序号|任务|步骤/.test(cols[0]))

  return rows.map((cols, index) => ({
    id: index + 1,
    title: cols[1] ?? cols[0],
    estimate: cols[2] ?? '',
    why: cols[3] ?? '',
    done: false,
  }))
}

/** 兜底：从列表项/编号行提取 */
function parseFallback(md: string): Task[] {
  const items: { title: string; meta: string }[] = []

  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (!line) continue

    const m = line.match(/^(?:[-*•]|\d+[.、)])\s+(.+)$/)
    if (!m) continue

    let text = m[1].replace(/\*\*/g, '').replace(/`/g, '').trim()
    if (text.length < 4) continue

    let meta = ''
    const paren = text.match(/[（(]([^）)]*(?:小时|分钟|天|周)[^）)]*)[）)]/)
    if (paren) {
      meta = paren[1]
      text = text.replace(paren[0], '').trim()
    }

    const parts = text.split(/\s*[—–]\s*|\s*：\s*|\s*:\s*/)
    if (parts.length > 1) {
      text = parts[0].trim()
      if (!meta) meta = parts.slice(1).join(' ').trim()
    }

    if (text.length >= 4) items.push({ title: text, meta })
  }

  return items.slice(0, 8).map((it, index) => {
    const isDuration = /^\s*\d+\s*[-–~]?\s*\d*\s*(小时|分钟|天|周|min|h)/.test(it.meta)
    return {
      id: index + 1,
      title: it.title,
      estimate: isDuration ? it.meta : '',
      why: isDuration ? '' : it.meta,
      done: false,
    }
  })
}

export async function POST(req: Request) {
  const { goal } = await req.json()

  if (!goal || typeof goal !== 'string' || !goal.trim()) {
    return Response.json({ error: '请先描述你的目标' }, { status: 400 })
  }

  const viaCustom = useCustomModel()
  let resp: Response

  try {
    resp = viaCustom ? await callCustomModel(goal) : await callZhihu(goal)
  } catch (e) {
    console.error('[plan] 调用模型失败:', e)
    return Response.json({ error: '连不上模型服务，检查网络或密钥' }, { status: 500 })
  }

  if (!resp.ok) {
    const text = await resp.text()
    console.error(`[plan] 上游错误 source=${viaCustom ? 'custom' : 'zhihu'} status=${resp.status}`, text.slice(0, 300))

    if (resp.status === 429) {
      return Response.json({ error: '额度用完了，明天再来试试' }, { status: 429 })
    }
    if (resp.status === 401 || resp.status === 403) {
      return Response.json({ error: '密钥无效，检查 .env.local 后重启服务' }, { status: 502 })
    }
    return Response.json({ error: '规划失败，请稍后再试' }, { status: 502 })
  }

  const data = await resp.json()
  const content: string = data.choices?.[0]?.message?.content ?? ''

  let tasks = parseTable(content)
  let mode = 'table'

  if (tasks.length === 0) {
    tasks = parseFallback(content)
    mode = 'fallback'
  }

  console.log(`[plan] source=${viaCustom ? 'custom' : 'zhihu'} mode=${mode} tasks=${tasks.length}`)

  if (tasks.length === 0) {
    console.error('[plan] 无法解析，原始输出:', content.slice(0, 800))
    return Response.json(
      { error: '没能整理出任务，换个说法试试', raw: content.slice(0, 1500) },
      { status: 502 }
    )
  }

  return Response.json({ tasks, mode })
}
