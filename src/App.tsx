import {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react'

type Tier = 'warmup' | 'middle' | 'hidden' | 'final'
type RoomId = 'memory' | 'clue' | 'vault' | 'exit'

interface Quest {
  id: string
  tier: Tier
  room: RoomId
  title: string
  subtitle: string
  object: string
  inspect: string
  x: number
  y: number
  baseReward: number
  question: string
  hint: string
  answers: string[]
  emoji: string
}

type QuestEdit = { question: string; answers: string[]; hint: string }

const HINT_PENALTY = 10000
const INVITE_CODE = '050821'
const SAVE_KEY = 'birthday-progress'

type Attempt = {
  id: string
  title: string
  room: RoomId
  input: string
  correct: boolean
  at: number
}

type Progress = {
  unlocked: boolean
  started: boolean
  room: RoomId
  solved: Record<string, number>
  misses: Record<string, number>
  attempts: Attempt[]
}

function emptyProgress(): Progress {
  return { unlocked: false, started: false, room: 'memory', solved: {}, misses: {}, attempts: [] }
}

function readCookie(name: string): string | null {
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || readCookie(SAVE_KEY)
    if (!raw) return emptyProgress()
    const p = JSON.parse(raw) as Partial<Progress>
    return {
      ...emptyProgress(),
      ...p,
      solved: p.solved ?? {},
      misses: p.misses ?? {},
      attempts: Array.isArray(p.attempts) ? p.attempts : [],
    }
  } catch {
    return emptyProgress()
  }
}

function persistProgress(p: Progress) {
  const raw = JSON.stringify(p)
  try { localStorage.setItem(SAVE_KEY, raw) } catch { /* ignore */ }
  try {
    document.cookie = `${SAVE_KEY}=${encodeURIComponent(raw)};max-age=31536000;path=/;SameSite=Lax`
  } catch { /* ignore */ }
}

function normCode(s: string) {
  return s.trim().replace(/\s+/g, '').toLowerCase()
}

const QUESTS: Quest[] = [
  { id:'w1', tier:'warmup', room:'memory', title:'달력', subtitle:'날짜가 동그라미 쳐져 있다',
    object:'달력', inspect:'벽에 걸린 달력. 어떤 날이 진하게 표시돼 있어.',
    x:27, y:42, baseReward:25000,
    question:'우리가 사귀게 된 날짜는? (8자리로 써 줘, YYYYMMDD)', hint:'이거 모르면 뒤지셈',
    answers:['20240308'], emoji:'🗓️' },
  { id:'w2', tier:'warmup', room:'memory', title:'영화 티켓', subtitle:'접힌 티켓 한 장',
    object:'티켓', inspect:'서랍에서 영화 티켓이 나왔다. 제목이 흐릿하다.',
    x:10, y:72, baseReward:25000,
    question:'우리가 처음 같이 본 영화는?', hint:'개노잼이라 잤음 😴',
    answers:['웡카','wonka','Wonka'], emoji:'🎬' },
  { id:'w3', tier:'warmup', room:'memory', title:'사진', subtitle:'그날의 장소',
    object:'액자', inspect:'액자 뒤에 쪽지가 숨겨져 있다.',
    x:86, y:76, baseReward:25000,
    question:'우리가 첫키스 한 장소는? (장소로 써 줘)', hint:'니가 먼저 했잖아',
    answers:['장재리'], emoji:'❤️' },
  { id:'w4', tier:'warmup', room:'memory', title:'핸드폰', subtitle:'카톡이 켜져 있다',
    object:'핸드폰', inspect:'오래된 카톡 창이 그대로 남아 있다. 첫 메시지가…',
    x:58, y:52, baseReward:25000,
    question:'오빠가 나한테 카톡으로 한 첫마디는?',
    hint:'한글자',
    answers:['ㅋ'], emoji:'💬' },
  { id:'w5', tier:'warmup', room:'memory', title:'베개', subtitle:'잠들기 전의 말',
    object:'베개', inspect:'베개 밑에 쪽지가 끼어 있다.',
    x:38, y:6, baseReward:25000,
    question:'오빠가 자기 전에 나한테 꼭 하는 말은?', hint:'내가 맨날 시킴',
    answers:['잘자 사랑해','사랑해 잘자','잘자사랑해','사랑해잘자','잘 자 사랑해','사랑해 잘 자'], emoji:'🌙' },

  { id:'m1', tier:'middle', room:'clue', title:'퀴즈 1', subtitle:'',
    object:'자물쇠', inspect:'',
    x:24, y:52, baseReward:25000,
    question:'내 한자 이름은? 한자로 써줘', hint:'쉽자나',
    answers:['李采潤'], emoji:'🔒' },
  { id:'m2', tier:'middle', room:'clue', title:'퀴즈 2', subtitle:'',
    object:'자물쇠', inspect:'',
    x:52, y:32, baseReward:25000,
    question:'무로 다닐 때 내 인생 최대 몸무게를 찍었는데 몇이게 ㅋ\n소수점까지 맞혀야함 ㅋ', hint:'힌트는 58 이상 59 이하',
    answers:['58.7'], emoji:'🔒' },
  { id:'m3', tier:'middle', room:'clue', title:'퀴즈 3', subtitle:'',
    object:'자물쇠', inspect:'',
    x:76, y:48, baseReward:25000,
    question:'내 세컨폰 아이폰 기종은? ㅋ', hint:'숫자 한개',
    answers:['6'], emoji:'🔒' },
  { id:'m4', tier:'middle', room:'clue', title:'퀴즈 4', subtitle:'',
    object:'자물쇠', inspect:'',
    x:58, y:68, baseReward:25000,
    question:'아빠 기일은? 이거 모르면 진짜... 0000으로 숫자로 써줘 (월,일)', hint:'ㅗ',
    answers:['0927','0928'], emoji:'🔒' },
  { id:'m5', tier:'middle', room:'clue', title:'퀴즈 5', subtitle:'',
    object:'자물쇠', inspect:'',
    x:12, y:70, baseReward:25000,
    question:'내 키는? 소수점까지는 안적어도 돼 ㅋ', hint:'이거 모르면 걍 죽어',
    answers:['158'], emoji:'🔒' },
  { id:'m6', tier:'middle', room:'clue', title:'퀴즈 6', subtitle:'',
    object:'자물쇠', inspect:'',
    x:36, y:78, baseReward:25000,
    question:'내 발사이즈는? (운동화 기준)', hint:'',
    answers:['240'], emoji:'🔒' },

  { id:'k1', tier:'hidden', room:'vault', title:'퀴즈 1', subtitle:'',
    object:'자물쇠', inspect:'',
    x:18, y:42, baseReward:25000,
    question:'', hint:'', answers:[], emoji:'🔒' },
  { id:'k2', tier:'hidden', room:'vault', title:'퀴즈 2', subtitle:'',
    object:'자물쇠', inspect:'',
    x:38, y:68, baseReward:25000,
    question:'', hint:'', answers:[], emoji:'🔒' },
  { id:'k3', tier:'hidden', room:'vault', title:'퀴즈 3', subtitle:'',
    object:'자물쇠', inspect:'',
    x:62, y:30, baseReward:25000,
    question:'', hint:'', answers:[], emoji:'🔒' },
  { id:'k4', tier:'hidden', room:'vault', title:'퀴즈 4', subtitle:'',
    object:'자물쇠', inspect:'',
    x:82, y:58, baseReward:25000,
    question:'', hint:'', answers:[], emoji:'🔒' },
  { id:'k5', tier:'hidden', room:'vault', title:'퀴즈 5', subtitle:'',
    object:'자물쇠', inspect:'',
    x:28, y:22, baseReward:25000,
    question:'', hint:'', answers:[], emoji:'🔒' },

]

const ROOMS: { id: RoomId; name: string; hint: string }[] = [
  { id:'memory', name:'무로', hint:'이곳에서의 첫만남 기억해?' },
  { id:'clue',   name:'집',     hint:'우리 집을 둘러보고, 눈에 띄는 곳을 눌러봐.' },
  { id:'vault',  name:'노래방',   hint:'노래방을 둘러봐.' },
  { id:'exit',   name:'출구',     hint:'사랑해.' },
]

const MAX_TRIES = 2

const TIER = {
  warmup: { label:'무로', en:'MURO', color:'#dc2626', light:'#fff1f2', border:'#fecaca' },
  middle: { label:'집', en:'HOME', color:'#e11d48', light:'#fff5f5', border:'#fda4af' },
  hidden: { label:'노래방', en:'KARAOKE', color:'#be123c', light:'#fef2f2', border:'#fb7185' },
  final:  { label:'사랑해', en:'LOVE',  color:'#dc2626', light:'#fff1f2', border:'#dc2626' },
}

function useCountUp(target: number, duration = 600) {
  const [display, setDisplay] = useState(target)
  const raf = useRef<number>(0)
  const prev = useRef(target)

  useEffect(() => {
    const from = prev.current
    const diff = target - from
    if (diff === 0) return
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + diff * ease))
      if (p < 1) raf.current = requestAnimationFrame(step)
      else prev.current = target
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return display
}

interface CP { id:number; x:number; color:string; size:number; dur:number; del:number }
function mkConfetti(n=70): CP[] {
  const cols = ['#dc2626','#ef4444','#fecaca','#fff','#f87171','#111','#fb7185']
  return Array.from({length:n},(_,i)=>({
    id:i, x:Math.random()*100, color:cols[i%cols.length],
    size:6+Math.random()*8, dur:2.2+Math.random()*2, del:Math.random()*1.2,
  }))
}

interface Coin { id:number; x:number; y:number }
let coinId = 0

function Header({
  earned, poppingMoney, onHome,
}: { earned:number; poppingMoney:boolean; onHome:()=>void }) {
  const displayed = useCountUp(earned, 700)
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
      style={{
        background:'rgba(255,255,255,0.92)',
        backdropFilter:'blur(12px)',
        borderBottom:'1.5px solid #fecaca',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors"
          aria-label="홈으로"
        >
          ← 홈
        </button>
      </div>
      <div className={`flex items-center gap-2 ${poppingMoney ? 'money-pop' : ''}`}>
        <span className="text-xl">💰</span>
        <span
          className="font-black text-lg tabular-nums"
          style={{ color:'#dc2626', fontFamily:'JetBrains Mono, monospace' }}
        >
          {displayed.toLocaleString()}원
        </span>
      </div>
    </div>
  )
}

function HintButton({
  onReveal, revealed, hint, disabled,
}: { onReveal:()=>void; revealed:boolean; hint:string; disabled:boolean }) {
  const [confirming, setConfirming] = useState(false)

  if (revealed) return (
    <div className="rounded-xl px-4 py-3 text-sm text-gray-600 text-center bg-red-50 border border-dashed border-red-200">
      {hint}
    </div>
  )

  if (confirming) return (
    <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-center">
      <p className="text-red-600 font-bold text-sm mb-2">
        ⚠️ 힌트를 보면 -{HINT_PENALTY.toLocaleString()}원 차감!
      </p>
      <p className="text-gray-500 text-xs mb-3">그래도 볼 거야?</p>
      <div className="flex gap-2 justify-center">
        <button
          onClick={()=>{setConfirming(false); onReveal()}}
          className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer hover:bg-red-700 transition-colors"
        >
          차감하고 볼게
        </button>
        <button
          onClick={()=>setConfirming(false)}
          className="px-4 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold cursor-pointer hover:bg-gray-50 transition-colors"
        >
          아니, 됐어
        </button>
      </div>
    </div>
  )

  return (
    <button
      onClick={()=>!disabled && setConfirming(true)}
      disabled={disabled}
      className="w-full text-center text-xs font-mono text-gray-400 hover:text-red-500 transition-colors cursor-pointer underline underline-offset-2 disabled:cursor-not-allowed"
    >
      단서 더 보기 (-{HINT_PENALTY.toLocaleString()}원 패널티)
    </button>
  )
}

function InspectModal({
  quest, alreadySolved, alreadyFailed, missCount, earnedReward, onSolve, onWrong, onAttempt, onClose, onSave,
}: {
  quest: Quest
  alreadySolved?: boolean
  alreadyFailed?: boolean
  missCount: number
  earnedReward?: number
  onSolve: (q: Quest, hintUsed: boolean, el: HTMLElement) => void
  onWrong: (id: string) => void
  onAttempt: (q: Quest, input: string, correct: boolean) => void
  onClose: () => void
  onSave: (id: string, edit: QuestEdit) => void
}) {
  const cfg = TIER[quest.tier]
  const needsSetup = !quest.question.trim() || quest.answers.length === 0
  const [editing, setEditing] = useState(needsSetup)
  const [draftQ, setDraftQ] = useState(quest.question)
  const [draftA, setDraftA] = useState(quest.answers.join(', '))
  const [draftH, setDraftH] = useState(quest.hint)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle'|'wrong'|'correct'>('idle')
  const [hintUsed, setHintUsed] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number|null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const shakeRef  = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const solveRef  = useRef<HTMLButtonElement>(null)
  const qRef = useRef<HTMLTextAreaElement>(null)
  const [out, setOut] = useState(!!alreadyFailed)
  const noTries = out || missCount >= MAX_TRIES

  useEffect(()=>{
    if (editing) {
      setTimeout(()=>qRef.current?.focus(), 200)
      return
    }
    if (alreadySolved) return
    setTimeout(()=>inputRef.current?.focus(), 200)
  }, [alreadySolved, editing])

  useEffect(()=>{
    if (timeLeft===null || status==='correct' || timedOut) return
    if (timeLeft<=0){ setTimedOut(true); return }
    const t = setTimeout(()=>setTimeLeft(s=>(s??1)-1), 1000)
    return ()=>clearTimeout(t)
  },[timeLeft, status, timedOut])

  const check = useCallback(()=>{
    if (timedOut || status==='correct' || noTries) return
    const val = input.trim().toLowerCase()
    const compact = val.replace(/\s+/g, '')
    const answers = quest.answers.map(a => a.toLowerCase())
    if (answers.includes(val) || answers.map(a => a.replace(/\s+/g, '')).includes(compact)) {
      onAttempt(quest, input.trim(), true)
      setStatus('correct')
      setTimeout(()=>onSolve(quest, hintUsed, solveRef.current!), 500)
    } else {
      onAttempt(quest, input.trim(), false)
      setStatus('wrong')
      onWrong(quest.id)
      shakeRef.current?.classList.remove('shake')
      void shakeRef.current?.offsetWidth
      shakeRef.current?.classList.add('shake')
      if (missCount + 1 >= MAX_TRIES) setOut(true)
      else setTimeout(()=>setStatus('idle'), 1400)
    }
  }, [input, quest, hintUsed, onSolve, onWrong, onAttempt, timedOut, status, noTries, missCount])

  const timeRatio  = timeLeft!==null ? timeLeft/30 : 1
  const timeColor  = timeRatio>0.5 ? '#16a34a' : timeRatio>0.25 ? '#d97706' : '#dc2626'
  const effectiveReward = quest.baseReward - (hintUsed ? HINT_PENALTY : 0)

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{background:'rgba(15,23,42,0.28)', backdropFilter:'blur(6px)'}}
      onClick={e=>e.target===e.currentTarget && onClose()}
    >
      <div
        ref={shakeRef}
        className="w-full max-w-md rounded-3xl overflow-hidden slide-up"
        style={{
          background:'#ffffff',
          border:`2px solid ${cfg.border}`,
          boxShadow:'0 20px 60px rgba(220,38,38,0.12)',
        }}
      >
        <div className="px-5 py-3 flex items-center justify-between" style={{background:cfg.light}}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{quest.emoji}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="font-black text-base tabular-nums"
              style={{color: effectiveReward<quest.baseReward ? '#f87171' : cfg.color, fontFamily:'JetBrains Mono,monospace'}}
            >
              {effectiveReward.toLocaleString()}원
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-lg cursor-pointer ml-1">×</button>
          </div>
        </div>

        <div className="px-6 py-5">
          {editing ? (
            <div>
              <p className="text-red-500 font-black text-sm mb-4">질문과 정답을 적어 줘</p>
              <label className="block text-xs font-bold text-gray-500 mb-1">질문</label>
              <textarea
                ref={qRef}
                className="w-full rounded-xl px-4 py-3 text-sm mb-3 resize-none"
                style={{ background:'#fffafa', border:'1.5px solid #fecaca', color:'#1f2937', outline:'none' }}
                rows={3}
                placeholder="예: 우리가 처음 만난 곳은?"
                value={draftQ}
                onChange={e=>setDraftQ(e.target.value)}
              />
              <label className="block text-xs font-bold text-gray-500 mb-1">정답</label>
              <input
                className="w-full rounded-xl px-4 py-3 text-sm mb-1"
                style={{ background:'#fffafa', border:'1.5px solid #fecaca', color:'#1f2937', outline:'none' }}
                type="text"
                placeholder="여러 개면 쉼표로 구분해"
                value={draftA}
                onChange={e=>setDraftA(e.target.value)}
              />
              <p className="text-gray-400 text-[11px] mb-3">예: 무로, muro</p>
              <label className="block text-xs font-bold text-gray-500 mb-1">힌트 (선택)</label>
              <input
                className="w-full rounded-xl px-4 py-3 text-sm mb-5"
                style={{ background:'#ffffff', border:'1.5px solid #e5e7eb', color:'#1f2937', outline:'none' }}
                type="text"
                placeholder="몰라도 괜찮아"
                value={draftH}
                onChange={e=>setDraftH(e.target.value)}
              />
              <button
                onClick={()=>{
                  const answers = parseAnswers(draftA)
                  if (!draftQ.trim() || answers.length === 0) return
                  onSave(quest.id, { question: draftQ.trim(), answers, hint: draftH.trim() })
                  setEditing(false)
                }}
                disabled={!draftQ.trim() || !draftA.trim()}
                className="w-full rounded-xl py-3 font-black text-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background:'#dc2626', color:'#fff' }}
              >
                저장하기
              </button>
              {!needsSetup && (
                <button
                  onClick={()=>setEditing(false)}
                  className="w-full mt-2 text-gray-400 hover:text-red-500 text-sm cursor-pointer"
                >
                  취소
                </button>
              )}
            </div>
          ) : (
          <>
          {timeLeft!==null && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400 font-mono">TIMER</span>
                <span className="font-black text-sm tabular-nums" style={{color:timeColor, fontFamily:'JetBrains Mono,monospace'}}>
                  {timedOut ? '시간 초과!' : `${timeLeft}s`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-red-50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{width:`${timeRatio*100}%`, background:timeColor}}
                />
              </div>
            </div>
          )}

          <div
            className="rounded-2xl px-5 py-4 mb-5 text-center"
            style={{background:'#fffafa', border:`1.5px solid ${cfg.border}`}}
          >
            <p className="font-bold text-gray-800 text-sm leading-relaxed">{quest.question}</p>
          </div>

          {alreadySolved ? (
            <div className="text-center">
              <div
                className="rounded-2xl px-5 py-4 mb-4"
                style={{background:'#f0fdf4', border:'1.5px solid #86efac'}}
              >
                <p className="text-green-600 font-mono text-xs mb-2">이미 열었어 · 정답</p>
                <p className="font-black text-gray-800 text-lg">{quest.answers[0]}</p>
                {earnedReward != null && (
                  <p className="text-red-500 font-mono text-xs mt-2">
                    +{earnedReward.toLocaleString()}원
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-xl py-3 font-black text-sm cursor-pointer"
                style={{ background:'#dc2626', color:'#fff' }}
              >
                닫기
              </button>
              <button
                onClick={()=>setEditing(true)}
                className="w-full mt-3 text-gray-400 hover:text-red-500 text-xs cursor-pointer"
              >
                질문 바꾸기
              </button>
            </div>
          ) : noTries ? (
            <div className="text-center">
              <div className="mb-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                <p className="text-gray-600 text-sm font-bold">이 문제는 기회를 다 썼어</p>
                <p className="text-gray-400 text-xs mt-1">틀린 문제는 한 번만 다시 풀 수 있어</p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-xl py-3 font-black text-sm cursor-pointer"
                style={{ background:'#dc2626', color:'#fff' }}
              >
                닫기
              </button>
            </div>
          ) : timedOut ? (
            <div className="text-center py-4">
              <p className="text-red-500 font-black text-lg mb-2">⏰ 타임 오버!</p>
              <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-sm cursor-pointer">
                닫기
              </button>
            </div>
          ) : (
            <>
              {missCount >= 1 && (
                <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-center">
                  <p className="text-red-600 text-xs font-bold">마지막 기회야! 한 번만 더 풀 수 있어</p>
                </div>
              )}
              <input
                ref={inputRef}
                className="w-full rounded-xl px-4 py-3 text-sm mb-2 font-mono transition-all duration-150"
                style={{
                  background:'#ffffff',
                  border:`1.5px solid ${status==='wrong'?'#dc2626':status==='correct'?'#16a34a':'#e5e7eb'}`,
                  color:'#1f2937',
                  outline:'none',
                }}
                type="text"
                placeholder="자물쇠 암호 입력..."
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&check()}
                disabled={status==='correct'||noTries}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="h-4 mb-3 text-center">
                {status==='wrong' && !noTries && (
                  <p className="text-red-500 text-xs font-mono">틀렸어. 한 번만 더 시도할 수 있어</p>
                )}
                {status==='wrong' && noTries && (
                  <p className="text-red-500 text-xs font-mono">기회를 다 썼어</p>
                )}
                {status==='correct' && (
                  <p className="text-green-600 text-xs font-mono">열렸다! +{effectiveReward.toLocaleString()}원</p>
                )}
              </div>

              <button
                ref={solveRef}
                onClick={check}
                disabled={!input.trim()||status==='correct'||noTries}
                className="w-full rounded-xl py-3 font-black text-sm cursor-pointer transition-all duration-150 mb-4 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: noTries ? '#d1d5db' : '#dc2626', color:'#fff' }}
              >
                자물쇠 열기
              </button>

              {quest.hint.trim() !== '' && (
              <HintButton
                onReveal={()=>setHintUsed(true)}
                revealed={hintUsed}
                hint={quest.hint}
                disabled={noTries}
              />
              )}
              <button
                onClick={()=>setEditing(true)}
                className="w-full mt-3 text-gray-400 hover:text-red-500 text-xs cursor-pointer"
              >
                질문 바꾸기
              </button>
            </>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  )
}

function CharacterSlot({ place = 'right', small, src }: { place?: 'center' | 'right' | 'left'; small?: boolean; src: string }) {
  const [ok, setOk] = useState(true)
  const centered = place === 'center'
  const size = small ? 'h-32' : centered ? 'h-44 sm:h-52' : 'h-36'
  const spot =
    place === 'center' ? 'left-1/2 bottom-[6%] -translate-x-1/2'
    : place === 'left' ? 'left-[7%] bottom-[7%]'
    : 'right-[7%] bottom-[7%]'
  return (
    <div
      className={`absolute z-20 flex items-end justify-center pointer-events-none ${spot}`}
    >
      {ok ? (
        <img
          key={src}
          src={src}
          alt=""
          className={`w-auto object-contain ${size} drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]`}
          onError={()=>setOk(false)}
        />
      ) : (
        <div className={`${small ? 'h-32 w-[4.5rem]' : 'h-36 w-24'} rounded-t-full border-2 border-dashed border-red-200 bg-red-50`} />
      )}
    </div>
  )
}

const POS_KEY = 'birthday-icon-positions'
const EDIT_KEY = 'birthday-quest-edits'
const LETTER_KEY = 'birthday-love-letter'

function loadLetter(): string {
  try {
    return localStorage.getItem(LETTER_KEY) ?? ''
  } catch {
    return ''
  }
}

function LoveLetter({ onGift }: { onGift: () => void }) {
  const saved = loadLetter()
  const [text, setText] = useState(saved)
  const [draft, setDraft] = useState(saved)
  const [editing, setEditing] = useState(!saved.trim())

  const save = () => {
    localStorage.setItem(LETTER_KEY, draft)
    setText(draft)
    setEditing(false)
  }

  return (
    <div
      className="mx-4 mt-3 rounded-xl px-4 py-4 min-h-[160px]"
      style={{
        background: 'linear-gradient(180deg, #fffdf8 0%, #fff7ed 100%)',
        border: '1.5px solid #fecaca',
        boxShadow: '0 8px 20px rgba(220,38,38,0.06)',
      }}
    >
      <p className="text-red-400 text-xs font-black tracking-widest mb-3">💌 편지</p>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={'오빠에게,\n\n여기에 편지를 써 줘.'}
            className="w-full min-h-[140px] resize-y rounded-lg px-3 py-2 text-sm leading-relaxed"
            style={{
              background: '#fffefb',
              border: '1.5px solid #fecaca',
              color: '#1f2937',
              outline: 'none',
              fontFamily: "'Gaegu', cursive",
              fontSize: '1.15rem',
            }}
          />
          <button
            type="button"
            onClick={save}
            className="mt-3 w-full rounded-xl py-2.5 font-black text-white text-sm cursor-pointer"
            style={{ background: '#dc2626' }}
          >
            편지 접어 두기
          </button>
        </>
      ) : (
        <>
          <p
            className="text-gray-700 whitespace-pre-wrap leading-relaxed"
            style={{ fontFamily: "'Gaegu', cursive", fontSize: '1.2rem' }}
          >
            {text.trim() ? text : '아직 편지가 없어.'}
          </p>
          <button
            type="button"
            onClick={() => { setDraft(text); setEditing(true) }}
            className="mt-3 text-red-300 hover:text-red-500 text-xs cursor-pointer"
          >
            편지 고치기
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onGift}
        className="mt-4 w-full rounded-2xl py-3.5 font-black text-white text-base cursor-pointer pulse-red"
        style={{ background: '#dc2626' }}
      >
        🎁 선물 받기
      </button>
    </div>
  )
}

function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) || '{}') as Record<string, { x: number; y: number }>
  } catch {
    return {}
  }
}

function loadQuestEdits(): Record<string, QuestEdit> {
  try {
    return JSON.parse(localStorage.getItem(EDIT_KEY) || '{}') as Record<string, QuestEdit>
  } catch {
    return {}
  }
}

function parseAnswers(raw: string): string[] {
  return raw.split(/[,/，\n]/).map(s => s.trim()).filter(Boolean)
}

function RoomView({
  room, quests, solved, lockedIds, gameOver, positions, onMove, onInspect,
}: {
  room: RoomId
  quests: Quest[]
  solved: Map<string, number>
  lockedIds: Set<string>
  gameOver: boolean
  positions: Record<string, { x: number; y: number }>
  onMove: (id: string, x: number, y: number) => void
  onInspect: (q: Quest) => void
}) {
  const palettes: Record<RoomId, { wall: string; floor: string; accent: string }> = {
    memory: { wall:'#f8fafc', floor:'#ffffff', accent:'#fecaca' },
    clue:   { wall:'#f8fafc', floor:'#ffffff', accent:'#e5e7eb' },
    vault:  { wall:'#fff1f2', floor:'#ffffff', accent:'#fecaca' },
    exit:   { wall:'#fff7f7', floor:'#ffffff', accent:'#fecaca' },
  }
  const pal = palettes[room]
  const isMuro = room === 'memory'
  const isHome = room === 'clue'
  const isKaraoke = room === 'vault'
  const isExit = room === 'exit'
  const photoBg = isMuro ? '/rooms/muro.png?v=2' : isHome ? '/rooms/home.png?v=3' : isKaraoke ? '/rooms/karaoke.png' : isExit ? '/rooms/love.png' : null
  const roomRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: string
    startX: number
    startY: number
    moved: boolean
  } | null>(null)

  const posOf = (q: Quest) => positions[q.id] ?? { x: q.x, y: q.y }

  const toPct = (clientX: number, clientY: number) => {
    const rect = roomRef.current!.getBoundingClientRect()
    return {
      x: Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(96, Math.max(4, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  return (
    <div
      ref={roomRef}
      className="relative mx-4 mt-3 rounded-2xl overflow-hidden select-none"
      style={{
        height: isExit ? 'min(38vh, 300px)' : 'min(62vh, 480px)',
        background: photoBg
          ? `center / cover no-repeat url(${photoBg})`
          : `linear-gradient(180deg, ${pal.wall} 0%, ${pal.wall} 58%, ${pal.accent} 58%, ${pal.floor} 100%)`,
        boxShadow:'0 8px 28px rgba(220,38,38,0.08)',
        border:'1.5px solid #fecaca',
      }}
    >
      {!photoBg && (
        <>
          <div className="lamp-flicker absolute left-1/2 top-2 w-24 h-10 -translate-x-1/2 rounded-full bg-red-200/50 blur-md pointer-events-none" />
          <div className="absolute left-[8%] top-[18%] w-[84%] h-[38%] rounded-sm opacity-20 pointer-events-none"
            style={{ background:'linear-gradient(180deg, transparent, rgba(220,38,38,0.08))', border:'8px solid rgba(254,202,202,0.35)' }} />
        </>
      )}
      {quests.map(q=>{
        const done = solved.has(q.id)
        const locked = !done && (lockedIds.has(q.id) || gameOver)
        const pos = posOf(q)
        return (
          <button
            key={q.id}
            type="button"
            className="absolute z-30 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            style={{
              left:`${pos.x}%`,
              top:`${pos.y}%`,
              transform:'translate(-50%,-50%)',
            }}
            aria-label={done ? '정답 다시 보기' : '조사'}
            onPointerDown={e=>{
              e.preventDefault()
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { id:q.id, startX:e.clientX, startY:e.clientY, moved:false }
            }}
            onPointerMove={e=>{
              if (!drag.current || drag.current.id !== q.id) return
              const dx = e.clientX - drag.current.startX
              const dy = e.clientY - drag.current.startY
              if (!drag.current.moved && dx * dx + dy * dy < 64) return
              drag.current.moved = true
              const next = toPct(e.clientX, e.clientY)
              onMove(q.id, next.x, next.y)
            }}
            onPointerUp={()=>{
              const d = drag.current
              drag.current = null
              if (!d || d.id !== q.id) return
              if (!d.moved && !locked) onInspect(q)
            }}
            onPointerCancel={()=>{ drag.current = null }}
          >
            <span
              className={`text-3xl ${(done ? '🔓' : locked ? '🔒' : q.emoji) === '🔒' ? '' : 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]'}`}
              style={{
                filter: locked ? 'grayscale(1) brightness(0.5)' : undefined,
                opacity: (done ? '🔓' : locked ? '🔒' : q.emoji) === '🔒' ? 0.32 : 1,
              }}
            >
              {done ? '🔓' : locked ? '🔒' : q.emoji}
            </span>
          </button>
        )
      })}

      {!isExit && (
        <CharacterSlot
          place={isMuro ? 'center' : 'right'}
          small={isHome}
          src={isHome ? '/character-girl.png?v=3' : '/character.png?v=3'}
        />
      )}
      {isKaraoke && (
        <CharacterSlot
          place="left"
          src="/character-girl.png?v=3"
        />
      )}
    </div>
  )
}

function CoinOverlay({ coins }: { coins: Coin[] }) {
  return (
    <>
      {coins.map(c=>(
        <div key={c.id} className="coin-particle" style={{ left:c.x, top:c.y, position:'fixed' }}>
          🪙
        </div>
      ))}
    </>
  )
}

function FinalScreen({ earned, onClose }: { earned:number; onClose:()=>void }) {
  const [confetti] = useState(mkConfetti(90))
  const displayed = useCountUp(earned, 1100)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 overflow-auto"
      style={{ background:'radial-gradient(ellipse at center, #fff1f2 0%, #ffffff 72%)' }}
    >
      {confetti.map(c=>(
        <div key={c.id} className="confetti-piece"
          style={{left:`${c.x}%`,width:c.size,height:c.size,background:c.color,borderRadius:'2px',
            animationDuration:`${c.dur}s`,animationDelay:`${c.del}s`}} />
      ))}

      <div className="text-center slide-up max-w-sm w-full">
        <div className="text-6xl mb-4">🎂</div>
        <h1 className="shimmer-red text-4xl font-black mb-2 tracking-tight">생일 축하해!</h1>
        <p className="text-red-400 text-sm mb-8" style={{ fontFamily: "'Gaegu', cursive", fontSize: '1.25rem' }}>
          퀴즈 맞혀서 모은 선물이야
        </p>

        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-7 mb-6 shadow-sm">
          <p className="text-gray-400 text-sm mb-2 font-mono">총 획득 상금</p>
          <p className="font-black text-5xl tabular-nums mb-1 text-red-600" style={{fontFamily:'JetBrains Mono,monospace'}}>
            {displayed.toLocaleString()}
          </p>
          <p className="text-red-500 font-black text-2xl">원</p>
        </div>

        <p
          className="text-gray-600 leading-relaxed mb-8"
          style={{ fontFamily: "'Gaegu', cursive", fontSize: '1.25rem' }}
        >
          우리 추억을 다 기억해 줘서 고마워.
          <br />
          생일 축하해, 사랑해 ❤️
        </p>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-red-500 text-sm cursor-pointer"
        >
          편지 다시 보기
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [boot] = useState(loadProgress)
  const [started, setStarted] = useState(boot.started)
  const [unlocked, setUnlocked] = useState(boot.unlocked)
  const [solved, setSolved] = useState(() => new Map<string, number>(Object.entries(boot.solved)))
  const [misses, setMisses] = useState(() => new Map<string, number>(Object.entries(boot.misses)))
  const [attempts, setAttempts] = useState<Attempt[]>(boot.attempts)
  const [invite, setInvite] = useState('')
  const [inviteErr, setInviteErr] = useState(false)
  const [active, setActive] = useState<Quest|null>(null)
  const [coins, setCoins] = useState<Coin[]>([])
  const [poppingMoney, setPoppingMoney] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const [room, setRoom] = useState<RoomId>(boot.room)
  const [narration, setNarration] = useState('이곳에서의 첫만남 기억해?')
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(loadPositions)
  const [questEdits, setQuestEdits] = useState<Record<string, QuestEdit>>(loadQuestEdits)

  const quests = useMemo(
    () => QUESTS.map(q => questEdits[q.id] ? { ...q, ...questEdits[q.id] } : q),
    [questEdits],
  )

  const handleMove = useCallback((id: string, x: number, y: number) => {
    setPositions(prev => {
      const next = { ...prev, [id]: { x, y } }
      localStorage.setItem(POS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const handleSaveQuest = useCallback((id: string, edit: QuestEdit) => {
    setQuestEdits(prev => {
      const next = { ...prev, [id]: edit }
      localStorage.setItem(EDIT_KEY, JSON.stringify(next))
      return next
    })
    setActive(prev => prev && prev.id === id ? { ...prev, ...edit } : prev)
  }, [])

  const earned = useMemo(()=>[...solved.values()].reduce((s,v)=>s+v,0), [solved])
  const failedIds = useMemo(() => {
    const s = new Set<string>()
    misses.forEach((n, id) => { if (n >= MAX_TRIES) s.add(id) })
    return s
  }, [misses])
  const allDone = quests.every(q => solved.has(q.id))

  useEffect(() => {
    persistProgress({
      unlocked,
      started,
      room,
      solved: Object.fromEntries(solved),
      misses: Object.fromEntries(misses),
      attempts,
    })
  }, [unlocked, started, room, solved, misses, attempts])

  const spawnCoins = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const newCoins: Coin[] = Array.from({length:5},()=>({
      id: coinId++,
      x: cx + (Math.random()-0.5)*40,
      y: cy + (Math.random()-0.5)*20,
    }))
    setCoins(prev=>[...prev, ...newCoins])
    setTimeout(()=>setCoins(prev=>prev.filter(c=>!newCoins.includes(c))), 1000)
  }, [])

  const handleSolve = useCallback((q: Quest, hintUsed: boolean, el: HTMLElement) => {
    const reward = q.baseReward - (hintUsed ? HINT_PENALTY : 0)
    setSolved(prev=>new Map([...prev, [q.id, reward]]))
    setActive(null)
    const unlockingExit = q.room !== 'exit' && quests.filter(x => x.room !== 'exit' && x.id !== q.id).every(x => solved.has(x.id))
    setNarration(unlockingExit ? '사랑해 방이 열렸다.' : `${q.object}의 자물쇠가 열렸다.`)
    spawnCoins(el)
    setTimeout(()=>{ setPoppingMoney(true); setTimeout(()=>setPoppingMoney(false), 450) }, 200)
  }, [spawnCoins, quests, solved])

  const handleWrong = useCallback((id: string)=>{
    setMisses(prev => {
      const next = new Map(prev)
      next.set(id, (next.get(id) ?? 0) + 1)
      return next
    })
  }, [])

  const handleAttempt = useCallback((q: Quest, input: string, correct: boolean) => {
    setAttempts(prev => [...prev, {
      id: q.id,
      title: q.title,
      room: q.room,
      input,
      correct,
      at: Date.now(),
    }])
  }, [])

  const openDoor = () => {
    if (unlocked) {
      setStarted(true)
      return
    }
    if (normCode(invite) !== normCode(INVITE_CODE)) {
      setInviteErr(true)
      return
    }
    setInviteErr(false)
    setUnlocked(true)
    setStarted(true)
  }

  const othersDone = allDone

  const isLocked = (_q: Quest): boolean => false

  const roomUnlocked = (id: RoomId) => id !== 'exit' || othersDone

  const lockedIds = useMemo(() => {
    const s = new Set<string>()
    QUESTS.forEach(q => { if (isLocked(q)) s.add(q.id) })
    return s
  }, [solved, othersDone])

  const roomQuests = quests.filter(q => q.room === room)
  const roomStats = useMemo(() => {
    const stats: Record<RoomId, { done: number; total: number }> = {
      memory: { done: 0, total: 0 },
      clue: { done: 0, total: 0 },
      vault: { done: 0, total: 0 },
      exit: { done: 0, total: 0 },
    }
    quests.forEach(q => {
      stats[q.room].total += 1
      if (solved.has(q.id)) stats[q.room].done += 1
    })
    return stats
  }, [quests, solved])

  if (!started) return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background:'radial-gradient(ellipse at center, #fff1f2 0%, #ffffff 70%)' }}
    >
      <div className="text-7xl mb-5">🚪</div>
      <h1 className="shimmer-red text-4xl font-black mb-1 tracking-tight">생일 방탈출</h1>
      <p className="text-red-400 font-mono text-xs mb-8">마운자로 값 벌자 ㅋ</p>

      <div className="w-full max-w-sm bg-white border-2 border-red-100 rounded-3xl p-6 mb-6 text-left shadow-sm">
        <p className="text-gray-600 text-sm leading-relaxed mb-5">
          오빠 생일축하해! 퀴즈 맞히면 돈이 쌓이는 방탈출 할 준비 됐지? 사랑해
        </p>
        <div className="space-y-2 mb-5">
          {ROOMS.map(r=>(
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
              <span className="text-gray-500 flex-1 text-xs">{r.name}</span>
            </div>
          ))}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-red-600 font-bold text-sm">❤️ 틀린 문제는 한 번만 다시 풀 수 있어</p>
          <p className="text-red-400 text-xs">두 번 틀리면 그 자물쇠는 안 열린다</p>
        </div>
      </div>

      {!unlocked && (
        <div className="w-full max-w-sm mb-4">
          <input
            className="w-full rounded-2xl px-4 py-3 text-center text-sm font-mono"
            style={{
              background: '#fff',
              border: `2px solid ${inviteErr ? '#dc2626' : '#fecaca'}`,
              color: '#1f2937',
              outline: 'none',
            }}
            type="text"
            placeholder="초대코드 입력"
            value={invite}
            onChange={e=>{ setInvite(e.target.value); setInviteErr(false) }}
            onKeyDown={e=>{ if (e.key==='Enter') openDoor() }}
            autoComplete="off"
            spellCheck={false}
          />
          {inviteErr && (
            <p className="text-red-500 text-xs font-bold mt-2">초대코드가 틀렸어</p>
          )}
        </div>
      )}

      {(attempts.length > 0 || solved.size > 0) && (
        <div className="w-full max-w-sm mb-5 rounded-3xl border-2 border-red-100 bg-white p-5 text-left shadow-sm max-h-56 overflow-auto">
          <p className="text-red-500 font-black text-xs mb-1">풀이 기록</p>
          <p className="text-gray-400 text-xs mb-3">
            맞춤 {solved.size} · 실패 {[...failedIds].length} · {earned.toLocaleString()}원
          </p>
          <div className="space-y-2">
            {attempts.slice().reverse().map((a, i) => (
              <div key={`${a.at}-${i}`} className="flex items-start gap-2 text-xs">
                <span>{a.correct ? '✅' : '❌'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-700 font-bold truncate">
                    {ROOMS.find(r => r.id === a.room)?.name ?? a.room} · {a.title}
                  </p>
                  <p className="text-gray-400 truncate">입력: {a.input || '(빈칸)'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={openDoor}
        className="pulse-red rounded-2xl px-10 py-4 font-black text-white text-lg cursor-pointer"
        style={{background:'#dc2626'}}
      >
        {unlocked ? '이어서 하기 →' : '문을 연다 →'}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'#ffffff'}}>
      <CoinOverlay coins={coins} />
      {active && (
        <InspectModal
          key={active.id}
          quest={active}
          alreadySolved={solved.has(active.id)}
          alreadyFailed={failedIds.has(active.id)}
          missCount={misses.get(active.id) ?? 0}
          earnedReward={solved.get(active.id)}
          onSolve={handleSolve}
          onWrong={handleWrong}
          onAttempt={handleAttempt}
          onClose={()=>setActive(null)}
          onSave={handleSaveQuest}
        />
      )}
      {showFinal && <FinalScreen earned={earned} onClose={()=>setShowFinal(false)} />}

      <Header
        earned={earned}
        poppingMoney={poppingMoney}
        onHome={()=>{ setActive(null); setShowFinal(false); setStarted(false) }}
      />

      <div className="max-w-md mx-auto pb-10">
        <div className="flex gap-1 px-4 pt-3">
          {ROOMS.map(r=>{
            const open = roomUnlocked(r.id)
            const here = room === r.id
            return (
              <button
                key={r.id}
                type="button"
                disabled={!open}
                onClick={()=>{
                  if (!open) return
                  setRoom(r.id)
                  setNarration(open ? ROOMS.find(x=>x.id===r.id)!.hint : '')
                }}
                className="flex-1 rounded-lg py-2 text-[11px] font-black cursor-pointer disabled:cursor-not-allowed"
                style={{
                  background: here ? '#dc2626' : open ? '#fff' : '#f9fafb',
                  color: here ? '#fff' : open ? '#dc2626' : '#d1d5db',
                  border: `1px solid ${here ? '#dc2626' : open ? '#fecaca' : '#e5e7eb'}`,
                }}
              >
                {open ? (
                  <span className="flex flex-col items-center leading-tight">
                    <span>{r.id === 'exit' ? '사랑해' : r.name}</span>
                    {r.id !== 'exit' && (
                      <span className="mt-0.5 font-mono text-[10px] font-normal opacity-80">
                        {roomStats[r.id].done}/{roomStats[r.id].total} 해제
                      </span>
                    )}
                  </span>
                ) : '🔒'}
              </button>
            )
          })}
        </div>

        <RoomView
          room={room}
          quests={roomQuests}
          solved={solved}
          lockedIds={lockedIds}
          gameOver={false}
          positions={positions}
          onMove={handleMove}
          onInspect={q=>{
            setActive(q)
          }}
        />

        {room === 'exit' ? (
          <LoveLetter onGift={()=>setShowFinal(true)} />
        ) : (
          <div className="mx-4 mt-3 rounded-xl bg-red-50/70 border border-red-100 px-4 py-3 min-h-[52px]">
            <p className="text-gray-600 text-sm leading-relaxed">{narration}</p>
          </div>
        )}
      </div>
    </div>
  )
}
