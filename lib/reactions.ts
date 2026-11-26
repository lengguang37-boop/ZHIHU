/**
 * 刘看山的反应台词。
 * 全部写死在前端，打勾这种高频动作不调用任何接口，不消耗额度。
 */

export type Reaction = {
  text: string
  mood: 'idle' | 'happy' | 'concerned' | 'proud'
}

/** 完成第一件事 */
const FIRST_DONE: string[] = [
  '第一件就做完了。这条线刚才是静的，现在有点声音了。',
  '开头最难，你已经把它推过去了。',
  '嗯，动起来了。我本来以为你会先放着。',
]

/** 连续完成（2 件及以上但没全部完成） */
const ON_A_ROLL: string[] = [
  '连续做完两个了，节奏起来了。',
  '你今天有点不像平时的你。',
  '别停，趁手还热。',
]

/** 单件完成但中间隔了很久（这里简化为普通完成） */
const NORMAL_DONE: string[] = [
  '记下了。',
  '✓ 这一步过了。',
  '好，往后挪一格。',
  '做完一件，剩下的事就没那么吓人了。',
]

/** 全部完成 */
const ALL_DONE: string[] = [
  '全做完了。比你计划的时间早。',
  '整条线都亮了。这个进度我记住了。',
  '你要不要……先坐一会儿。今天够了。',
]

/** 取消勾选 */
const UNCHECK: string[] = [
  '退了？那我把它放回去。',
  '没关系，改主意也是常事。',
  '我把它先搁着，你想起来再说。',
]

/** 拖了很久没动（页面加载时如果有未完成任务超过 3 天） */
const STALE: string[] = [
  '那个挂了几天了。我不催你，就是提一下。',
  '要不要把这件往后放一放，先做别的？',
]

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)]
}

/** 根据当前完成情况选一句台词 */
export function reactToToggle(params: {
  justDone: boolean
  doneCount: number
  total: number
}): Reaction {
  const { justDone, doneCount, total } = params

  if (!justDone) {
    return { text: pick(UNCHECK), mood: 'idle' }
  }

  if (doneCount === total && total > 0) {
    return { text: pick(ALL_DONE), mood: 'proud' }
  }

  if (doneCount === 1) {
    return { text: pick(FIRST_DONE), mood: 'happy' }
  }

  if (doneCount >= 3) {
    return { text: pick(ON_A_ROLL), mood: 'happy' }
  }

  return { text: pick(NORMAL_DONE), mood: 'happy' }
}

/** 计划搁置太久时的提醒 */
export function staleReaction(): Reaction {
  return { text: pick(STALE), mood: 'concerned' }
}

/** 生成计划后，刘看山的第一句话 */
export function greeting(total: number): Reaction {
  return {
    text: `我把它拆成 ${total} 件了。你不用一次想完全部，从最上面那件开始就行。`,
    mood: 'idle',
  }
}
