'use client'

import { useEffect, useState } from 'react'
import type { Reaction } from '@/lib/reactions'

type Props = {
  reaction: Reaction | null
}

/**
 * 刘看山形象 + 说话气泡。
 * 目前用单张立绘 + CSS 状态变化，后续换成 Live2D 时只需替换内部渲染部分。
 */
export default function Kanshan({ reaction }: Props) {
  const [visible, setVisible] = useState(false)

  // 台词变化时重新触发一次气泡动画
  useEffect(() => {
    if (!reaction) return
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [reaction])

  const mood = reaction?.mood ?? 'idle'

  // 不同心情对应不同的轻微形变，制造"它在反应"的感觉
  const figureClass =
    mood === 'happy'
      ? 'animate-[bob_1.4s_ease-in-out_infinite]'
      : mood === 'proud'
      ? 'animate-[bob_1s_ease-in-out_infinite]'
      : mood === 'concerned'
      ? 'animate-[tilt_2.4s_ease-in-out_infinite]'
      : 'animate-[idle_4s_ease-in-out_infinite]'

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-end gap-3">

      {/* 气泡 */}
      {reaction && (
        <div
          className={`max-w-[260px] rounded-2xl rounded-br-sm bg-white px-4 py-3
                      text-sm leading-relaxed text-neutral-800 shadow-lg ring-1 ring-neutral-200
                      transition-all duration-300
                      ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
        >
          {reaction.text}
        </div>
      )}

      {/* 形象 */}
      <div className="shrink-0">
        <img
          src="/will.png"
          alt="刘看山"
          className={`h-24 w-24 select-none object-contain drop-shadow-md ${figureClass}`}
          draggable={false}
        />
      </div>

    </div>
  )
}
