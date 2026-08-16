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

const HINT_PENALTY = 3000

const QUESTS: Quest[] = [
  { id:'w1', tier:'warmup', room:'memory', title:'달력', subtitle:'날짜가 동그라미 쳐져 있다',
    object:'달력', inspect:'벽에 걸린 달력. 어떤 날이 진하게 표시돼 있어.',
    x:22, y:68, baseReward:10000,
    question:'우리가 사귀게 된 날짜는? (8자리로 써 줘, YYYYMMDD)', hint:'이거 모르면 뒤지셈',
    answers:['20240308'], emoji:'🗓️' },
  { id:'w2', tier:'warmup', room:'memory', title:'영화 티켓', subtitle:'접힌 티켓 한 장',
    object:'티켓', inspect:'서랍에서 영화 티켓이 나왔다. 제목이 흐릿하다.',
    x:24, y:46, baseReward:10000,
    question:'우리가 처음 같이 본 영화는?', hint:'개노잼이라 잤음 😴',
    answers:['웡카','wonka','Wonka'], emoji:'🎬' },
  { id:'w3', tier:'warmup', room:'memory', title:'사진', subtitle:'그날의 장소',
    object:'액자', inspect:'액자 뒤에 쪽지가 숨겨져 있다.',
    x:90, y:36, baseReward:10000,
    question:'우리가 첫키스 한 장소는? (장소로 써 줘)', hint:'니가 먼저 했잖아',
    answers:['장재리'], emoji:'💋' },
  { id:'w4', tier:'warmup', room:'memory', title:'핸드폰', subtitle:'카톡이 켜져 있다',
    object:'핸드폰', inspect:'오래된 카톡 창이 그대로 남아 있다. 첫 메시지가…',
    x:78, y:68, baseReward:10000,
    question:'오빠가 나한테 카톡으로 한 첫마디는?',
    hint:'한글자',
    answers:['ㅋ'], emoji:'💬' },
  { id:'w5', tier:'warmup', room:'memory', title:'베개', subtitle:'잠들기 전의 말',
    object:'베개', inspect:'베개 밑에 쪽지가 끼어 있다.',
    x:12, y:44, baseReward:10000,
    question:'오빠가 자기 전에 나한테 꼭 하는 말은?', hint:'내가 맨날 시킴',
    answers:['잘자 사랑해','사랑해 잘자','잘자사랑해','사랑해잘자','잘 자 사랑해','사랑해 잘 자'], emoji:'🌙' },

  { id:'m1', tier:'middle', room:'clue', title:'파란 노트', subtitle:'책상 위',
    object:'노트', inspect:'파란 노트를 펼쳤다. 첫 페이지에 숫자가 적혀 있다.',
    x:24, y:52, baseReward:20000,
    question:'책상 위 파란 노트 첫 페이지에 적힌 네 자리 숫자는?',
    hint:'직접 가서 찾아봐야 해 📒 (책상 위 파란 노트)',
    answers:['0315','0 3 1 5'], emoji:'📒' },
  { id:'m2', tier:'middle', room:'clue', title:'암호 쪽지', subtitle:'벽에 붙어 있다',
    object:'쪽지', inspect:'종이에 이상한 알파벳이 적혀 있다.',
    x:52, y:32, baseReward:20000,
    question:'ROT13으로 암호화된 문자야: "UNPXRE" — 원래 단어는?',
    hint:'알파벳을 13칸 앞으로 밀면 돼. N→A, O→B... 🔐',
    answers:['hacker','HACKER'], emoji:'🔐' },
  { id:'m3', tier:'middle', room:'clue', title:'무전기', subtitle:'전공 문제',
    object:'무전기', inspect:'무전기에서 잡음과 함께 문제가 흘러나온다.',
    x:76, y:48, baseReward:20000,
    question:'N-point DFT를 FFT로 계산할 때 시간 복잡도는?',
    hint:'Cooley–Tukey 알고리즘이 핵심 🦋',
    answers:['o(n log n)','nlogn','n log n','o(nlogn)','O(NlogN)'], emoji:'📡' },
  { id:'m4', tier:'middle', room:'clue', title:'컴퓨터', subtitle:'탐색의 예술',
    object:'컴퓨터', inspect:'화면에 잠금 프롬프트가 떠 있다.',
    x:58, y:68, baseReward:20000,
    question:'정렬된 배열에서 이진 탐색의 최악 시간 복잡도는?',
    hint:'탐색 범위가 매번 절반씩 줄어들지 ✂️',
    answers:['o(log n)','log n','o(logn)','θ(log n)'], emoji:'🔍' },
  { id:'m5', tier:'middle', room:'clue', title:'우산', subtitle:'그날의 날씨',
    object:'우산', inspect:'우산 손잡이에 작은 자물쇠가 달려 있다.',
    x:12, y:70, baseReward:20000,
    question:'우리가 처음 손을 잡은 건 어떤 날이었어? (한 단어)',
    hint:'비가 엄청 왔었는데... ☔',
    answers:['비오는날','비','우천','장마'], emoji:'☔' },

  { id:'hidden', tier:'hidden', room:'vault', title:'금고', subtitle:'30초 안에',
    object:'금고', inspect:'금고 키패드가 깜빡인다. 시간이 얼마 없다!',
    x:50, y:52, baseReward:50000,
    question:'내 핸드폰 잠금 비밀번호 앞 4자리는?',
    hint:'내 생일이랑 관련 있어 🎂',
    answers:['1234','0101'], emoji:'⚡' },

  { id:'final', tier:'final', room:'exit', title:'출구', subtitle:'마지막 문',
    object:'문', inspect:'출구 문에 큰 자물쇠가 걸려 있다. 마지막이다.',
    x:50, y:46, baseReward:100000,
    question:'우리가 처음 "좋아해"라고 말한 장소 이름은?',
    hint:'그때 별이 엄청 많았는데... ⭐',
    answers:['한강','한강공원','반포한강공원','여의도한강공원'], emoji:'👑' },
]

const ROOMS: { id: RoomId; name: string; hint: string }[] = [
  { id:'memory', name:'무로', hint:'카페를 둘러보고, 눈에 띄는 곳을 눌러봐.' },
  { id:'clue',   name:'서재',     hint:'책상과 벽을 수색해.' },
  { id:'vault',  name:'금고방',   hint:'키패드가 깜빡이고 있어.' },
  { id:'exit',   name:'출구',     hint:'마지막 문이 기다리고 있어.' },
]

const WARMUP_IDS  = QUESTS.filter(q=>q.tier==='warmup').map(q=>q.id)
const MIDDLE_IDS  = QUESTS.filter(q=>q.tier==='middle').map(q=>q.id)
const MAX_LIVES   = 5
const TOTAL_BASE  = QUESTS.reduce((s,q)=>s+q.baseReward,0)

const TIER = {
  warmup: { label:'무로', en:'MURO', color:'#fbbf24', light:'#3b2a12', border:'#a16207' },
  middle: { label:'서재', en:'ROOM 2', color:'#93c5fd', light:'#1e293b', border:'#3b82f6' },
  hidden: { label:'금고방', en:'ROOM 3', color:'#fcd34d', light:'#3b2f0b', border:'#d97706' },
  final:  { label:'출구', en:'EXIT',  color:'#fca5a5', light:'#3b1515', border:'#dc2626' },
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
  const cols = ['#dc2626','#ef4444','#fbbf24','#111','#6b7280','#fff','#f87171']
  return Array.from({length:n},(_,i)=>({
    id:i, x:Math.random()*100, color:cols[i%cols.length],
    size:6+Math.random()*8, dur:2.2+Math.random()*2, del:Math.random()*1.2,
  }))
}

interface Coin { id:number; x:number; y:number }
let coinId = 0

function Lives({ lives, max }: { lives:number; max:number }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({length:max},(_,i)=>(
        <span
          key={i}
          className="text-lg select-none transition-all duration-300"
          style={{ opacity: i < lives ? 1 : 0.18, filter: i < lives ? 'none' : 'grayscale(1)' }}
        >
          ❤️
        </span>
      ))}
    </div>
  )
}

function Header({
  earned, lives, poppingMoney, onHome,
}: { earned:number; lives:number; poppingMoney:boolean; onHome:()=>void }) {
  const displayed = useCountUp(earned, 700)
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
      style={{
        background:'rgba(18,12,8,0.92)',
        backdropFilter:'blur(12px)',
        borderBottom:'1.5px solid #3a2a1c',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-amber-200/80 hover:bg-white/10 hover:text-amber-100 cursor-pointer transition-colors"
          aria-label="홈으로"
        >
          ← 홈
        </button>
        <Lives lives={lives} max={MAX_LIVES} />
      </div>
      <div className={`flex items-center gap-2 ${poppingMoney ? 'money-pop' : ''}`}>
        <span className="text-xl">💰</span>
        <span
          className="font-black text-lg tabular-nums"
          style={{ color:'#fbbf24', fontFamily:'JetBrains Mono, monospace' }}
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
    <div className="rounded-xl px-4 py-3 text-sm text-amber-100/80 text-center bg-black/30 border border-dashed border-amber-700/50">
      {hint}
    </div>
  )

  if (confirming) return (
    <div className="rounded-xl border-2 border-red-800 bg-red-950/60 p-3 text-center">
      <p className="text-red-400 font-bold text-sm mb-2">
        ⚠️ 힌트를 보면 -{HINT_PENALTY.toLocaleString()}원 차감!
      </p>
      <p className="text-amber-200/60 text-xs mb-3">그래도 볼 거야?</p>
      <div className="flex gap-2 justify-center">
        <button
          onClick={()=>{setConfirming(false); onReveal()}}
          className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer hover:bg-red-700 transition-colors"
        >
          차감하고 볼게
        </button>
        <button
          onClick={()=>setConfirming(false)}
          className="px-4 py-1.5 rounded-lg bg-black/40 border border-amber-800/40 text-amber-100 text-xs font-bold cursor-pointer hover:bg-black/60 transition-colors"
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
      className="w-full text-center text-xs font-mono text-amber-700 hover:text-amber-400 transition-colors cursor-pointer underline underline-offset-2 disabled:cursor-not-allowed"
    >
      단서 더 보기 (-{HINT_PENALTY.toLocaleString()}원 패널티)
    </button>
  )
}

function InspectModal({
  quest, livesLeft, onSolve, onWrong, onClose,
}: {
  quest: Quest
  livesLeft: number
  onSolve: (q: Quest, hintUsed: boolean, el: HTMLElement) => void
  onWrong: () => void
  onClose: () => void
}) {
  const cfg = TIER[quest.tier]
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle'|'wrong'|'correct'>('idle')
  const [hintUsed, setHintUsed] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number|null>(quest.tier==='hidden' ? 30 : null)
  const [timedOut, setTimedOut] = useState(false)
  const shakeRef  = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const solveRef  = useRef<HTMLButtonElement>(null)
  const gameOver  = livesLeft === 0

  useEffect(()=>{ setTimeout(()=>inputRef.current?.focus(), 200) }, [])

  useEffect(()=>{
    if (timeLeft===null || status==='correct' || timedOut) return
    if (timeLeft<=0){ setTimedOut(true); return }
    const t = setTimeout(()=>setTimeLeft(s=>(s??1)-1), 1000)
    return ()=>clearTimeout(t)
  },[timeLeft, status, timedOut])

  const check = useCallback(()=>{
    if (timedOut || status==='correct' || gameOver) return
    const val = input.trim().toLowerCase()
    const compact = val.replace(/\s+/g, '')
    const answers = quest.answers.map(a => a.toLowerCase())
    if (answers.includes(val) || answers.map(a => a.replace(/\s+/g, '')).includes(compact)) {
      setStatus('correct')
      setTimeout(()=>onSolve(quest, hintUsed, solveRef.current!), 500)
    } else {
      setStatus('wrong')
      onWrong()
      shakeRef.current?.classList.remove('shake')
      void shakeRef.current?.offsetWidth
      shakeRef.current?.classList.add('shake')
      setTimeout(()=>setStatus('idle'), 1400)
    }
  }, [input, quest, hintUsed, onSolve, onWrong, timedOut, status, gameOver])

  const timeRatio  = timeLeft!==null ? timeLeft/30 : 1
  const timeColor  = timeRatio>0.5 ? '#16a34a' : timeRatio>0.25 ? '#d97706' : '#dc2626'
  const effectiveReward = quest.baseReward - (hintUsed ? HINT_PENALTY : 0)

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)'}}
      onClick={e=>e.target===e.currentTarget && onClose()}
    >
      <div
        ref={shakeRef}
        className="w-full max-w-md rounded-3xl overflow-hidden slide-up"
        style={{
          background:'#24180f',
          border:`2px solid ${cfg.border}`,
          boxShadow:'0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="px-5 py-3 flex items-center justify-between" style={{background:cfg.light}}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{quest.emoji}</span>
            <span className="font-bold text-sm" style={{color:cfg.color}}>조사</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="font-black text-base tabular-nums"
              style={{color: effectiveReward<quest.baseReward ? '#f87171' : cfg.color, fontFamily:'JetBrains Mono,monospace'}}
            >
              {effectiveReward.toLocaleString()}원
            </span>
            <button onClick={onClose} className="text-amber-200/50 hover:text-amber-100 text-lg cursor-pointer ml-1">×</button>
          </div>
        </div>

        <div className="px-6 py-5">
          {timeLeft!==null && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-amber-700 font-mono">TIMER</span>
                <span className="font-black text-sm tabular-nums" style={{color:timeColor, fontFamily:'JetBrains Mono,monospace'}}>
                  {timedOut ? '시간 초과!' : `${timeLeft}s`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{width:`${timeRatio*100}%`, background:timeColor}}
                />
              </div>
            </div>
          )}

          <p className="text-amber-200/70 text-sm mb-4 leading-relaxed">{quest.inspect}</p>

          <div
            className="rounded-2xl px-5 py-4 mb-5 text-center"
            style={{background:'#1a120c', border:`1.5px solid ${cfg.border}`}}
          >
            <p className="font-bold text-amber-50 text-sm leading-relaxed">{quest.question}</p>
          </div>

          {livesLeft <= 2 && livesLeft > 0 && (
            <div className="mb-3 rounded-xl bg-red-950/50 border border-red-800 px-4 py-2 text-center">
              <p className="text-red-400 text-xs font-bold">기회가 {livesLeft}번밖에 안 남았어!</p>
            </div>
          )}
          {gameOver && (
            <div className="mb-3 rounded-xl bg-black/40 border border-zinc-700 px-4 py-2 text-center">
              <p className="text-zinc-400 text-xs font-bold">기회를 전부 써버렸어 😢</p>
            </div>
          )}

          {timedOut ? (
            <div className="text-center py-4">
              <p className="text-red-400 font-black text-lg mb-2">⏰ 타임 오버!</p>
              <button onClick={onClose} className="text-amber-200/50 hover:text-amber-100 text-sm cursor-pointer">
                닫기
              </button>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                className="w-full rounded-xl px-4 py-3 text-sm mb-2 font-mono transition-all duration-150"
                style={{
                  background:'#120c08',
                  border:`1.5px solid ${status==='wrong'?'#dc2626':status==='correct'?'#16a34a':'#5c4030'}`,
                  color:'#f5e6d3',
                  outline:'none',
                }}
                type="text"
                placeholder="자물쇠 암호 입력..."
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&check()}
                disabled={status==='correct'||gameOver}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="h-4 mb-3 text-center">
                {status==='wrong' && (
                  <p className="text-red-400 text-xs font-mono">자물쇠가 안 열린다… 기회 -1</p>
                )}
                {status==='correct' && (
                  <p className="text-green-400 text-xs font-mono">열렸다! +{effectiveReward.toLocaleString()}원</p>
                )}
              </div>

              <button
                ref={solveRef}
                onClick={check}
                disabled={!input.trim()||status==='correct'||gameOver}
                className="w-full rounded-xl py-3 font-black text-sm cursor-pointer transition-all duration-150 mb-4 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: gameOver ? '#3f3f46' : '#b45309', color:'#fff' }}
              >
                자물쇠 열기
              </button>

              <HintButton
                onReveal={()=>setHintUsed(true)}
                revealed={hintUsed}
                hint={quest.hint}
                disabled={gameOver}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CharacterSlot({ center }: { center?: boolean }) {
  const [ok, setOk] = useState(true)
  return (
    <div
      className={`absolute z-20 flex items-end justify-center pointer-events-none ${
        center ? 'left-1/2 bottom-[6%] -translate-x-1/2' : 'right-2 bottom-2'
      }`}
    >
      {ok ? (
        <img
          src="/character.png"
          alt=""
          className={`w-auto object-contain ${center ? 'h-44 sm:h-52' : 'h-36'} drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]`}
          onError={()=>setOk(false)}
        />
      ) : (
        <div className="h-36 w-24 rounded-t-full border-2 border-dashed border-amber-700/50 bg-black/30" />
      )}
    </div>
  )
}

function RoomView({
  room, quests, solved, lockedIds, gameOver, onInspect,
}: {
  room: RoomId
  quests: Quest[]
  solved: Map<string, number>
  lockedIds: Set<string>
  gameOver: boolean
  onInspect: (q: Quest) => void
}) {
  const palettes: Record<RoomId, { wall: string; floor: string; accent: string }> = {
    memory: { wall:'#3d2a1c', floor:'#2a1c12', accent:'#7c4a28' },
    clue:   { wall:'#1e2938', floor:'#121820', accent:'#334155' },
    vault:  { wall:'#2a2410', floor:'#1a160c', accent:'#4a3b12' },
    exit:   { wall:'#3b1518', floor:'#1a0c0e', accent:'#7f1d1d' },
  }
  const pal = palettes[room]
  const isMuro = room === 'memory'

  return (
    <div
      className="relative mx-4 mt-3 rounded-2xl overflow-hidden"
      style={{
        height: 'min(62vh, 480px)',
        background: isMuro
          ? 'center / cover no-repeat url(/rooms/muro.png)'
          : `linear-gradient(180deg, ${pal.wall} 0%, ${pal.wall} 58%, ${pal.accent} 58%, ${pal.floor} 100%)`,
        boxShadow:'inset 0 0 80px rgba(0,0,0,0.45)',
        border:'2px solid #3a2a1c',
      }}
    >
      {!isMuro && (
        <>
          <div className="lamp-flicker absolute left-1/2 top-2 w-24 h-10 -translate-x-1/2 rounded-full bg-amber-300/20 blur-md pointer-events-none" />
          <div className="absolute left-[8%] top-[18%] w-[84%] h-[38%] rounded-sm opacity-20 pointer-events-none"
            style={{ background:'linear-gradient(180deg, transparent, rgba(0,0,0,0.5))', border:'8px solid rgba(0,0,0,0.15)' }} />
        </>
      )}
      {room==='exit' && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 w-28 h-[46%] rounded-t-lg border-4 border-black/40"
          style={{ background:'linear-gradient(180deg,#4a1c1c,#2a1010)' }} />
      )}
      {room==='vault' && (
        <div className="absolute left-1/2 top-[30%] -translate-x-1/2 w-32 h-32 rounded-lg border-4 border-amber-900/60 bg-zinc-800/80" />
      )}

      {quests.map(q=>{
        const done = solved.has(q.id)
        const locked = lockedIds.has(q.id) || gameOver
        return (
          <button
            key={q.id}
            type="button"
            disabled={done || locked}
            onClick={()=>!done && !locked && onInspect(q)}
            className={`absolute z-10 flex items-center justify-center ${!done && !locked ? 'cursor-pointer' : 'cursor-default'}`}
            style={{
              left:`${q.x}%`,
              top:`${q.y}%`,
              transform:'translate(-50%,-50%)',
            }}
            aria-label="조사"
          >
            <span
              className="text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
              style={{ filter: done ? 'grayscale(0.4)' : locked ? 'grayscale(1) brightness(0.5)' : 'none' }}
            >
              {done ? '✅' : locked ? '🔒' : q.emoji}
            </span>
          </button>
        )
      })}

      <CharacterSlot center={isMuro} />
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

function GameOverBanner({ earned }: { earned:number }) {
  return (
    <div className="mx-4 mb-3 rounded-2xl px-5 py-4 text-center slide-up bg-red-950/70 border-2 border-red-800">
      <p className="text-2xl mb-1">💀</p>
      <p className="font-black text-red-300 text-base mb-1">갇혔어…</p>
      <p className="text-red-400/80 text-sm">
        남은 자물쇠는 안 열린다. 지금까지 <strong>{earned.toLocaleString()}원</strong>만 가져갈 수 있어.
      </p>
    </div>
  )
}

function FinalScreen({ earned, onClose }: { earned:number; onClose:()=>void }) {
  const [confetti] = useState(mkConfetti(80))
  const [phase, setPhase] = useState<'reveal'|'pay'>('reveal')
  const displayed = useCountUp(earned, 900)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 overflow-auto"
      style={{background:'rgba(12,8,6,0.96)'}}
    >
      {confetti.map(c=>(
        <div key={c.id} className="confetti-piece"
          style={{left:`${c.x}%`,width:c.size,height:c.size,background:c.color,borderRadius:'2px',
            animationDuration:`${c.dur}s`,animationDelay:`${c.del}s`}} />
      ))}

      {phase==='reveal' && (
        <div className="text-center slide-up max-w-sm w-full">
          <div className="text-6xl mb-4">🚪</div>
          <h1 className="shimmer-red text-4xl font-black mb-2">탈출 성공!</h1>
          <p className="text-amber-700 font-mono text-sm mb-8">DOOR UNLOCKED</p>

          <div className="bg-red-950/50 border-2 border-red-800 rounded-3xl p-6 mb-6">
            <p className="text-amber-200/50 text-sm mb-1 font-mono">총 획득 상금</p>
            <p className="font-black text-5xl tabular-nums mb-1 text-amber-300" style={{fontFamily:'JetBrains Mono,monospace'}}>
              {displayed.toLocaleString()}
            </p>
            <p className="text-red-400 font-black text-2xl">원</p>
          </div>

          <div className="bg-black/30 border border-amber-900/40 rounded-2xl p-5 mb-6 text-left">
            <p className="text-red-400 font-mono text-xs mb-3 uppercase tracking-widest">🎀 생일 메시지</p>
            <p className="text-amber-100/80 text-sm leading-relaxed mb-4">
              방 안의 단서를 다 찾았다는 건 우리 추억을 전부 기억하고 있다는 거잖아. 그게 제일 좋아. 생일 축하해! 💜
            </p>
            <div className="bg-amber-950/50 border border-amber-800 rounded-xl p-3">
              <p className="text-amber-400 font-mono text-xs mb-1">🎁 현금 봉투 위치</p>
              <p className="text-amber-50 font-black text-sm">책상 서랍 두 번째 칸 — 빨간 봉투 💌</p>
            </div>
          </div>

          <button
            onClick={()=>setPhase('pay')}
            className="w-full rounded-2xl py-4 font-black text-white text-base cursor-pointer pulse-red"
            style={{background:'#dc2626'}}
          >
            💸 상금 수령하기 →
          </button>
        </div>
      )}

      {phase==='pay' && (
        <div className="text-center slide-up max-w-sm w-full">
          <div className="text-5xl mb-4">💸</div>
          <h2 className="font-black text-2xl text-amber-50 mb-1">상금 수령</h2>
          <p className="text-amber-700 font-mono text-sm mb-6">{earned.toLocaleString()}원</p>

          <div className="rounded-2xl p-5 mb-3" style={{background:'#3182f6'}}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">💙</div>
              <div className="text-left flex-1">
                <p className="text-white font-black text-base">토스로 받기</p>
                <p className="text-blue-200 text-xs font-mono">Toss 송금 받기</p>
              </div>
              <span className="text-white font-black">{earned.toLocaleString()}원</span>
            </div>
          </div>

          <div className="rounded-2xl p-5 mb-3" style={{background:'#FAE100'}}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center text-xl">💛</div>
              <div className="text-left flex-1">
                <p className="text-gray-900 font-black text-base">카카오페이로 받기</p>
                <p className="text-yellow-700 text-xs font-mono">KakaoPay 송금 받기</p>
              </div>
              <span className="text-gray-900 font-black">{earned.toLocaleString()}원</span>
            </div>
          </div>

          <div className="rounded-2xl p-5 mb-6 border-2 border-amber-900/40 bg-black/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-900/50 flex items-center justify-center text-xl">💵</div>
              <div className="text-left flex-1">
                <p className="text-amber-50 font-black text-base">현금 봉투로 받기</p>
                <p className="text-amber-700 text-xs font-mono">책상 서랍 두 번째 칸 빨간 봉투</p>
              </div>
              <span className="text-amber-100 font-black">{earned.toLocaleString()}원</span>
            </div>
          </div>

          <button onClick={onClose} className="text-amber-700 hover:text-amber-300 text-sm cursor-pointer">
            처음으로 돌아가기
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [started, setStarted] = useState(false)
  const [lives, setLives] = useState(MAX_LIVES)
  const [solved, setSolved] = useState<Map<string,number>>(new Map())
  const [active, setActive] = useState<Quest|null>(null)
  const [coins, setCoins] = useState<Coin[]>([])
  const [poppingMoney, setPoppingMoney] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const [room, setRoom] = useState<RoomId>('memory')
  const [narration, setNarration] = useState('방을 둘러봐. 반짝이는 물건을 눌러.')

  const earned = useMemo(()=>[...solved.values()].reduce((s,v)=>s+v,0), [solved])
  const gameOver = lives === 0
  const warmupDone = WARMUP_IDS.every(id=>solved.has(id))
  const middleIds  = QUESTS.filter(q=>q.tier==='middle').map(q=>q.id)
  const middleDone = middleIds.every(id=>solved.has(id))
  const hiddenUnlocked = warmupDone && middleDone
  const hiddenDone     = solved.has('hidden')
  const finalUnlocked  = hiddenUnlocked && hiddenDone
  const allDone = finalUnlocked && solved.has('final')

  useEffect(()=>{ if(allDone) setTimeout(()=>setShowFinal(true), 900) }, [allDone])

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
    setNarration(`${q.object}의 자물쇠가 열렸다.`)
    spawnCoins(el)
    setTimeout(()=>{ setPoppingMoney(true); setTimeout(()=>setPoppingMoney(false), 450) }, 200)
  }, [spawnCoins])

  const handleWrong = useCallback(()=>{
    setLives(l=>Math.max(0, l-1))
  }, [])

  const isLocked = (q: Quest): boolean => {
    if (q.tier==='warmup') return false
    if (q.tier==='middle') {
      const idx = middleIds.indexOf(q.id)
      return idx>0 && !solved.has(middleIds[idx-1])
    }
    if (q.tier==='hidden') return !hiddenUnlocked
    if (q.tier==='final')  return !finalUnlocked
    return false
  }

  const roomUnlocked = (id: RoomId) => {
    if (id==='memory') return true
    if (id==='clue') return warmupDone
    if (id==='vault') return hiddenUnlocked
    if (id==='exit') return finalUnlocked
    return false
  }

  const lockedIds = useMemo(() => {
    const s = new Set<string>()
    QUESTS.forEach(q => { if (isLocked(q)) s.add(q.id) })
    return s
  }, [solved, hiddenUnlocked, finalUnlocked])

  const roomQuests = QUESTS.filter(q => q.room === room)
  const roomMeta = ROOMS.find(r => r.id === room)!

  if (!started) return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background:'radial-gradient(ellipse at center, #3b2418 0%, #120c08 70%)' }}
    >
      <div className="text-7xl mb-5">🚪</div>
      <h1 className="shimmer-red text-4xl font-black mb-1 tracking-tight">생일 방탈출</h1>
      <p className="text-amber-700 font-mono text-xs mb-8">문을 열고 들어가</p>

      <div className="w-full max-w-sm bg-black/35 border-2 border-amber-900/40 rounded-3xl p-6 mb-6 text-left">
        <p className="text-amber-100/80 text-sm leading-relaxed mb-5">
          어두운 방에 갇혔어. 물건을 수색해서 자물쇠를 열고, 총{' '}
          <span className="text-amber-300 font-black">{TOTAL_BASE.toLocaleString()}원</span>을 챙겨 탈출해.
        </p>
        <div className="space-y-2 mb-5">
          {ROOMS.map(r=>(
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full shrink-0 bg-amber-500" />
              <span className="text-amber-100/70 flex-1 text-xs">{r.name}</span>
            </div>
          ))}
        </div>
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 text-center">
          <p className="text-red-400 font-bold text-sm">❤️ 기회는 단 {MAX_LIVES}번!</p>
          <p className="text-red-500/80 text-xs">5번 틀리면 방에 갇힌다</p>
        </div>
      </div>

      <button
        onClick={()=>setStarted(true)}
        className="pulse-red rounded-2xl px-10 py-4 font-black text-white text-lg cursor-pointer"
        style={{background:'#b45309'}}
      >
        문을 연다 →
      </button>
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'#120c08'}}>
      <CoinOverlay coins={coins} />
      {active && (
        <InspectModal
          quest={active}
          livesLeft={lives}
          onSolve={handleSolve}
          onWrong={handleWrong}
          onClose={()=>setActive(null)}
        />
      )}
      {showFinal && <FinalScreen earned={earned} onClose={()=>{ setShowFinal(false); setStarted(false); setSolved(new Map()); setLives(MAX_LIVES); setRoom('memory') }} />}

      <Header
        earned={earned}
        lives={lives}
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
                  background: here ? '#b45309' : open ? '#2a1c12' : '#1a140f',
                  color: here ? '#fff' : open ? '#fcd34d' : '#5c4030',
                  border: `1px solid ${here ? '#d97706' : '#3a2a1c'}`,
                }}
              >
                {open ? r.name : '🔒'}
              </button>
            )
          })}
        </div>

        <p className="text-center text-amber-200/50 font-mono text-xs mt-2">
          {roomMeta.name} · {solved.size}/{QUESTS.length} 해제
        </p>

        {gameOver && <div className="mt-3"><GameOverBanner earned={earned} /></div>}

        <RoomView
          room={room}
          quests={roomQuests}
          solved={solved}
          lockedIds={lockedIds}
          gameOver={gameOver}
          onInspect={q=>{
            setActive(q)
            setNarration(q.inspect)
          }}
        />

        <div className="mx-4 mt-3 rounded-xl bg-black/40 border border-amber-900/30 px-4 py-3 min-h-[52px]">
          <p className="text-amber-100/80 text-sm leading-relaxed">{narration}</p>
        </div>
      </div>
    </div>
  )
}
