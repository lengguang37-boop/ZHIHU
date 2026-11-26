type Item = {
  title: string
  summary: string
  url: string
  author: string
  votes: number
}

type CacheEntry = { at: number; items: Item[] }

// 进程内缓存。搜索额度有限（10 次/天），同一关键词不重复搜。
const cache = new Map<string, CacheEntry>()
const TTL = 1000 * 60 * 30 // 30 分钟

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('q') ?? '').trim()

  if (!query) {
    return Response.json({ error: '缺少查询词' }, { status: 400 })
  }

  const key = query.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) {
    return Response.json({ items: hit.items, cached: true })
  }

  const url =
    'https://developer.zhihu.com/api/v1/content/zhihu_search?' +
    new URLSearchParams({ Query: query.slice(0, 40), Count: '3' }).toString()

  let resp: Response
  try {
    resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.ZHIHU_ACCESS_SECRET}`,
        'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
        'Content-Type': 'application/json',
      },
    })
  } catch {
    return Response.json({ error: '连不上知乎' }, { status: 502 })
  }

  if (!resp.ok) {
    const text = await resp.text()
    console.error('[search] 上游错误', resp.status, text.slice(0, 300))

    if (resp.status === 429) {
      return Response.json({ error: '搜索额度用完了' }, { status: 429 })
    }
    return Response.json({ error: '搜索失败' }, { status: 502 })
  }

  const data = await resp.json()
  const raw: any[] = data?.Data?.Items ?? []

  const items: Item[] = raw.map((it) => ({
    title: it.Title ?? '',
    summary: (it.ContentText ?? '').replace(/\s+/g, ' ').slice(0, 120),
    url: it.Url ?? '',
    author: it.AuthorName ?? '',
    votes: it.VoteUpCount ?? 0,
  }))

  cache.set(key, { at: Date.now(), items })

  return Response.json({ items, cached: false })
}
