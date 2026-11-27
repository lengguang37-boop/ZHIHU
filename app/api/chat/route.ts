// Vercel: 允许函数运行更久，推理模型通常需要 10-20 秒
export const maxDuration = 60

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

function hasCustomModel() {
  return Boolean(
    process.env.MODEL_BASE_URL &&
      process.env.MODEL_API_KEY &&
      process.env.MODEL_NAME
  )
}

function buildRequest(goal: string) {
  const useCustom = hasCustomModel()

  const base = useCustom ? process.env.MODEL_BASE_URL!.replace(/\/+$/, '') : ''
  const url = useCustom
    ? base.endsWith('/chat/completions')
      ? base
      : `${base}/chat/completions`
    : 'https://developer.zhihu.com/v1/chat/completions'

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (useCustom) {
    headers['Authorization'] = `Bearer ${process.env.MODEL_API_KEY}`
  } else {
    headers['Authorization'] = `Bearer ${process.env.ZHIHU_ACCESS_SECRET}`
    headers['X-Request-Timestamp'] = String(Math.floor(Date.now() / 1000))
  }

  const messages = [
    { role: 'system', content: PLANNER_PROMPT },
    { role: 'user', content: goal },
  ]

  const body = useCustom
    ? { model: process.env.MODEL_NAME, stream: true, temperature: 0.3, messages }
    : { model: 'zhida-fast-1p5', stream: true, messages }

  return { url, headers, body, source: useCustom ? 'custom' : 'zhihu' }
}

/**
 * 流式返回规划结果。
 *
 * 先建立 ReadableStream 并立刻吐出占位字节，把 fetch 放进流内部异步执行，
 * 确保响应头和首字节第一时间发出，避免平台的首字节超时限制。
 */
export async function POST(req: Request) {
  const { goal } = await req.json()

  if (!goal || typeof goal !== 'string' || !goal.trim()) {
    return Response.json({ error: '请先描述你的目标' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(': open\n\n'))

      const sendError = (msg: string) => {
        const payload = JSON.stringify({ error: msg })
        controller.enqueue(encoder.encode(`event: error\ndata: ${payload}\n\n`))
      }

      try {
        const { url, headers, body, source } = buildRequest(goal)

        const upstream = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '')
          console.error(
            `[plan] 上游错误 source=${source} status=${upstream.status}`,
            text.slice(0, 300)
          )

          if (upstream.status === 429) sendError('额度用完了，明天再来试试')
          else if (upstream.status === 401 || upstream.status === 403)
            sendError('密钥无效')
          else sendError('规划失败，请稍后再试')

          controller.close()
          return
        }

        const reader = upstream.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
      } catch (e) {
        console.error('[plan] 流异常', e)
        sendError('连不上模型服务')
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  })
}
