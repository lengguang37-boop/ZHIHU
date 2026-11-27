export type Task = {
  id: number
  title: string
  estimate: string
  why: string
  done: boolean
}

/** 从 Markdown 表格解析任务 */
export function parseTable(md: string): Task[] {
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

/** 兜底：模型没给表格时，从列表项/编号行提取 */
export function parseFallback(md: string): Task[] {
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

/** 先试表格，再退化到列表 */
export function parsePlan(md: string): Task[] {
  const t = parseTable(md)
  return t.length > 0 ? t : parseFallback(md)
}

/**
 * 解析 SSE 数据块，抽出 delta.content 文本。
 * 兼容心跳注释行和 [DONE] 结束标记。
 */
export function extractDelta(line: string): string | null {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    // 只取正式回答内容，忽略 reasoning_content 思考过程
    return json.choices?.[0]?.delta?.content ?? null
  } catch {
    return null
  }
}

/** 从 SSE 行里提取服务端下发的错误信息 */
export function extractStreamError(line: string): string | null {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    if (typeof json.error === 'string') return json.error
    return null
  } catch {
    return null
  }
}
