'use client'

import { useEffect, useState } from 'react'

type Task = {
  id: number
  title: string
  estimate: string
  why: string
  done: boolean
}

const STORAGE_KEY = 'kanshan-plan'

export default function Home() {
  const [goal, setGoal] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [raw, setRaw] = useState('')

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
    } catch {
      setError('网络好像断了，稍后再试')
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: number) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    )
  }

  function reset() {
    setTasks([])
    setGoal('')
    setError('')
    setRaw('')
    localStorage.removeItem(STORAGE_KEY)
  }

  const doneCount = tasks.filter((t) => t.done).length
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-2xl px-6 py-12">

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">刘看山帮你排计划</h1>
          <p className="mt-1 text-sm text-neutral-500">
            说一个目标，我拆成能做的小任务。
          </p>
        </header>

        {/* 输入区：显式指定文字颜色，避免深色模式下白字白底 */}
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
          {tasks.map((task) => (
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
            </li>
          ))}
        </ul>

        {!loading && tasks.length === 0 && !error && (
          <p className="mt-10 text-center text-sm text-neutral-400">
            还没有计划。上面写一句你想做的事。
          </p>
        )}

      </div>
    </main>
  )
}
