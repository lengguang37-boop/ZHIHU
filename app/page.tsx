'use client'

import { useEffect, useRef, useState } from 'react'
import Kanshan from '@/components/Kanshan'
import { reactToToggle, greeting, type Reaction } from '@/lib/reactions'

type Task = {
  id: number
  title: string
  estimate: string
  why: string
  done: boolean
}

type Ref = {
  title: string
  summary: string
  url: string
  author: string
  votes: number
}

const STORAGE_KEY = 'kanshan-plan'

export default function Home() {
  const [goal, setGoal] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [raw, setRaw] = useState('')
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 每个任务的经验查询状态
  const [refs, setRefs] = useState<Record<number, Ref[]>>({})
  const [refLoading, setRefLoading] = useState<Record<number, boolean>>({})
  const [refError, setRefError] = useState<Record<number, string>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as { goal: string; tasks: Task[] }
        setGoal(parsed.goal ?? '')
        setTasks(parsed.tasks ?? [])
      }
    } catch {
      /* 存档损坏就当没有 */
    }
  }, [])

  useEffect(() => {
    if (tasks.length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ goal, tasks }))
    } catch {
      /* 隐私模式写入会失败 */
    }
  }, [goal, tasks])

  async function generate() {
    if (!goal.trim() || loading) return

    setLoading(true)
    setError('')
    setRaw('')
    setTasks([])
    setRefs({})
    setRefError({})

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '生成失败')
        setRaw(data.raw ?? '')
        return
      }
      if (!data.tasks?.length) {
        setError('这次没整理出任务')
        setRaw(data.raw ?? '')
        return
      }
      setTasks(data.tasks)
      say(greeting(data.tasks.length))
    } catch {
      setError('网络好像断了，稍后再试')
    } finally {
      setLoading(false)
    }
  }

  async function loadRefs(task: Task) {
    // 已经加载过就不再请求
    if (refs[task.id] || refLoading[task.id]) return

    setRefLoading((prev) => ({ ...prev, [task.id]: true }))
    setRefError((prev) => ({ ...prev, [task.id]: '' }))

    try {
      // 从任务标题里提取最有检索价值的词组：
      // 优先取反引号内的技术名词，其次取英文字母串，最后退回标题本身
      const backtick = task.title.match(/`([^`]+)`/)
      const english = task.title.match(/[A-Za-z][A-Za-z0-9.\-/]{2,}/g)

      const keyword = backtick?.[1]
        ?? (english ? english.slice(0, 2).join(' ') : task.title.slice(0, 20))

      const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`)
      const data = await res.json()

      if (!res.ok) {
        setRefError((prev) => ({ ...prev, [task.id]: data.error ?? '没搜到' }))
        return
      }
      setRefs((prev) => ({ ...prev, [task.id]: data.items ?? [] }))
    } catch {
      setRefError((prev) => ({ ...prev, [task.id]: '网络问题' }))
    } finally {
      setRefLoading((prev) => ({ ...prev, [task.id]: false }))
    }
  }

  /** 让刘看山说话，8 秒后自动收起 */
  function say(r: Reaction) {
    setReaction(r)
    if (reactionTimer.current) clearTimeout(reactionTimer.current)
    reactionTimer.current = setTimeout(() => setReaction(null), 8000)
  }

  function toggle(id: number) {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      )
      const target = next.find((t) => t.id === id)
      const doneCount = next.filter((t) => t.done).length

      say(
        reactToToggle({
          justDone: Boolean(target?.done),
          doneCount,
          total: next.length,
        })
      )

      return next
    })
  }

  function reset() {
    setTasks([])
    setGoal('')
    setError('')
    setRaw('')
    setRefs({})
    setRefError({})
    localStorage.removeItem(STORAGE_KEY)
  }

  const doneCount = tasks.filter((t) => t.done).length
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-2xl px-6 py-12 pb-40">

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">刘看山帮你排计划</h1>
          <p className="mt-1 text-sm text-neutral-500">
            说一个目标，我拆成能做的小任务，每一步都附上别人的经验。
          </p>
        </header>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5
                       text-sm text-neutral-900 placeholder:text-neutral-400
                       outline-none focus:border-neutral-900 disabled:bg-neutral-100"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder="比如：两周内学会用 Next.js 做一个 AI 对话网页"
            disabled={loading}
          />
          <button
            className="shrink-0 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm text-white
                       disabled:opacity-40"
            onClick={generate}
            disabled={loading || !goal.trim()}
          >
            {loading ? '规划中…' : '生成计划'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            {raw && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-red-500">
                  查看模型的原始输出
                </summary>
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words
                                rounded bg-white p-3 text-xs text-neutral-700">
                  {raw}
                </pre>
              </details>
            )}
          </div>
        )}

        {tasks.length > 0 && (
          <div className="mt-8">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-neutral-900">
                {doneCount} / {tasks.length} 已完成
              </span>
              <button
                className="text-neutral-400 hover:text-neutral-900"
                onClick={reset}
              >
                清空
              </button>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-neutral-900 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {tasks.map((task) => {
            const list = refs[task.id]
            const busy = refLoading[task.id]
            const err = refError[task.id]

            return (
              <li
                key={task.id}
                className={`rounded-xl border bg-white p-4 transition
                  ${task.done
                    ? 'border-neutral-200 opacity-60'
                    : 'border-neutral-200 hover:border-neutral-300'}`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-neutral-900"
                    checked={task.done}
                    onChange={() => toggle(task.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`text-sm font-medium text-neutral-900
                          ${task.done ? 'line-through' : ''}`}
                      >
                        {task.title}
                      </span>
                      {task.estimate && (
                        <span className="shrink-0 rounded bg-neutral-100 px-2 py-0.5
                                         text-xs text-neutral-600">
                          {task.estimate}
                        </span>
                      )}
                    </div>
                    {task.why && (
                      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                        {task.why}
                      </p>
                    )}
                  </div>
                </label>

                {/* 经验区 */}
                <div className="mt-3 border-t border-neutral-100 pt-3 pl-7">
                  {!list && !busy && (
                    <button
                      className="text-xs text-neutral-500 hover:text-neutral-900"
                      onClick={() => loadRefs(task)}
                    >
                      ⌕ 看看别人在这步踩过什么坑
                    </button>
                  )}

                  {busy && (
                    <p className="text-xs text-neutral-400">正在翻知乎…</p>
                  )}

                  {err && <p className="text-xs text-amber-600">{err}</p>}

                  {list && list.length === 0 && (
                    <p className="text-xs text-neutral-400">
                      没找到相关经验，这步可能比较冷门。
                    </p>
                  )}

                  {list && list.length > 0 && (
                    <ul className="space-y-2.5">
                      {list.map((r, i) => (
                        <li key={i} className="text-xs leading-relaxed">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-neutral-800 hover:underline"
                          >
                            {r.title}
                          </a>
                          <span className="ml-1.5 text-neutral-400">
                            {r.author}
                            {r.votes > 0 && ` · ${r.votes} 赞`}
                          </span>
                          <p className="mt-0.5 text-neutral-500">{r.summary}…</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {!loading && tasks.length === 0 && !error && (
          <p className="mt-10 text-center text-sm text-neutral-400">
            还没有计划。上面写一句你想做的事。
          </p>
        )}

      </div>

      <Kanshan reaction={reaction} />
    </main>
  )
}
