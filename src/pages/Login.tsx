import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Boxes,
  User,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  Loader2,
  FolderArchive,
  FolderSync,
  UsersRound,
  BadgeCheck,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore, type Role } from '@/store'

type LoginMode = 'password' | 'sms'

/* ---------------- 左侧品牌区 ---------------- */

const features = [
  { icon: FolderArchive, title: 'eTMF 文档全生命周期管理', desc: '目录编制、递交、归档一体化' },
  { icon: FolderSync, title: '智能审核与流转', desc: '提交 / 驳回 / 发布全程可追踪' },
  { icon: UsersRound, title: '多中心协同与权限管控', desc: 'PM / CRA 多角色分权协作' },
]

const compliance = ['GCP 合规', '21 CFR Part 11', '数据加密存储']

function BrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16">
      {/* 渐变底 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(150deg, #0f766e 0%, #0d9488 28%, #0891b2 58%, #2563eb 100%)',
        }}
      />
      {/* 六边形网格 */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.10]" aria-hidden>
        <defs>
          <pattern id="hex" width="56" height="97" patternUnits="userSpaceOnUse">
            <path
              d="M28 0 56 16v32L28 64 0 48V16zM28 64v33M56 48l28 16M0 48l-28 16"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>
      {/* 光晕 */}
      <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="absolute bottom-10 -left-20 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
      {/* 心电线 */}
      <svg
        className="absolute right-0 bottom-40 w-[560px] opacity-30"
        viewBox="0 0 560 80"
        fill="none"
        aria-hidden
      >
        <path
          className="login-ekg"
          d="M0 40h150l14-26 20 52 16-40 10 14h90l14-26 20 52 16-40 10 14h200"
          stroke="white"
          strokeWidth="2"
          strokeDasharray="240 240"
        />
      </svg>

      {/* 品牌 */}
      <div className="relative flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 shadow-lg ring-1 ring-white/30 backdrop-blur">
          <Boxes className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <div>
          <div className="text-xl font-bold tracking-wide">CLINI X TRIALS</div>
          <div className="text-sm tracking-widest text-white/70">临床研究运营平台</div>
        </div>
      </div>

      {/* 主标语 + 价值点 */}
      <div className="relative max-w-xl">
        <h1 className="text-5xl leading-snug font-bold tracking-wide xl:text-[3.5rem]">
          以智能科技
          <br />
          赋能科研创新
        </h1>
        <p className="mt-5 flex items-center gap-3 text-2xl font-light tracking-[0.3em] text-cyan-100">
          <span className="inline-block h-px w-10 bg-cyan-200/70" />
          让研究轻松前行
        </p>

        <ul className="mt-14 space-y-6">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <li
              key={title}
              className="login-fade-up flex items-center gap-4"
              style={{ animationDelay: `${0.15 + i * 0.12}s` }}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/25 backdrop-blur">
                <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-base font-medium">{title}</div>
                <div className="mt-1 text-sm text-white/65">{desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 合规徽标 */}
      <div className="relative flex flex-wrap items-center gap-3">
        {compliance.map((c) => (
          <span
            key={c}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm tracking-wide ring-1 ring-white/20 backdrop-blur"
          >
            <BadgeCheck className="h-4 w-4 text-cyan-200" />
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------------- 输入框 ---------------- */

function Field({
  label,
  icon: Icon,
  error,
  children,
}: {
  label: string
  icon: typeof User
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-600">{label}</label>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-xl border bg-gray-50/60 px-4 transition-all focus-within:border-teal-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-500/10',
          error ? 'border-red-300' : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <Icon className="h-5 w-5 shrink-0 text-gray-400 transition-colors group-focus-within:text-teal-500" />
        {children}
      </div>
      {error && <p className="mt-1.5 text-[13px] text-red-500">{error}</p>}
    </div>
  )
}

const inputCls =
  'h-12 w-full bg-transparent text-base text-gray-800 outline-none placeholder:text-gray-400'

/* ---------------- 登录页 ---------------- */

export default function Login() {
  const { state, dispatch } = useStore()
  const [mode, setMode] = useState<LoginMode>('password')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [remember, setRemember] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
    },
    [],
  )

  const sendCode = () => {
    if (countdown > 0) return
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setErrors((e) => ({ ...e, phone: '请输入正确的 11 位手机号' }))
      return
    }
    setErrors((e) => ({ ...e, phone: '' }))
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1 && timerRef.current) clearInterval(timerRef.current)
        return c - 1
      })
    }, 1000)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}

    let role: Role = 'pm'
    let loginUser = ''
    let loginName = ''
    if (mode === 'password') {
      if (!account.trim()) errs.account = '请输入账号'
      if (!password) errs.password = '请输入登录密码'
      if (!errs.account && !errs.password) {
        const hit = state.accounts.find(
          (a) =>
            (a.username === account.trim() || a.name === account.trim()) && a.password === password,
        )
        if (!hit) {
          errs.password = '账号或密码错误，请重试'
        } else if (hit.status === '冻结') {
          errs.password = '该账号已被冻结，请联系系统管理员'
        } else if (hit.status === '关闭') {
          errs.password = '该账号已关闭，无法登录'
        } else {
          role = hit.role
          loginUser = hit.username
          loginName = hit.name
        }
      }
    } else {
      if (!/^1[3-9]\d{9}$/.test(phone)) errs.phone = '请输入正确的 11 位手机号'
      if (!/^\d{6}$/.test(code)) errs.code = '请输入 6 位数字验证码'
    }
    if (!agreed) errs.agreed = '请先阅读并同意服务协议与隐私政策'

    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    setTimeout(() => dispatch({ type: 'login', role, username: loginUser, name: loginName }), 900)
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.15fr_1fr]">
      <BrandPanel />

      {/* 右侧表单区 */}
      <div className="relative flex flex-col bg-gradient-to-b from-gray-50/80 to-white">
        {/* 顶部细装饰条 */}
        <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 lg:hidden" />

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="login-fade-up w-full max-w-[430px]">
            {/* 移动端品牌 */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 text-white shadow-md">
                <Boxes className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-lg font-bold tracking-wide text-gray-800">CLINI X TRIALS</div>
                <div className="text-xs tracking-widest text-gray-400">临床研究运营平台</div>
              </div>
            </div>

            <h2 className="text-3xl font-bold tracking-wide text-gray-900">欢迎回来</h2>
            <p className="mt-2 text-base text-gray-400">请使用您的账号信息登录平台</p>

            {/* 登录方式切换 */}
            <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
              {(
                [
                  ['password', '账号密码登录'],
                  ['sms', '手机验证码登录'],
                ] as [LoginMode, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode(key)
                    setErrors({})
                  }}
                  className={cn(
                    'h-10 rounded-lg text-sm font-medium transition-all',
                    mode === key
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} noValidate className="mt-7 space-y-5">
              {mode === 'password' ? (
                <>
                  <Field label="登录账号" icon={User} error={errors.account}>
                    <input
                      className={inputCls}
                      placeholder="请输入账号"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      autoComplete="username"
                    />
                  </Field>
                  <Field label="登录密码" icon={Lock} error={errors.password}>
                    <input
                      className={inputCls}
                      type={showPwd ? 'text' : 'password'}
                      placeholder="请输入登录密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="shrink-0 text-gray-400 transition-colors hover:text-teal-500"
                      aria-label={showPwd ? '隐藏密码' : '显示密码'}
                    >
                      {showPwd ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="手机号" icon={Smartphone} error={errors.phone}>
                    <input
                      className={cn(inputCls, 'font-num')}
                      placeholder="请输入注册手机号"
                      maxLength={11}
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    />
                  </Field>
                  <Field label="短信验证码" icon={ShieldCheck} error={errors.code}>
                    <input
                      className={cn(inputCls, 'font-num')}
                      placeholder="请输入 6 位验证码"
                      maxLength={6}
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={countdown > 0}
                      className={cn(
                        'shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-all',
                        countdown > 0
                          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                          : 'bg-teal-50 text-teal-600 hover:bg-teal-100',
                      )}
                    >
                      {countdown > 0 ? (
                        <span className="font-num">{`${countdown}s 后重发`}</span>
                      ) : (
                        '获取验证码'
                      )}
                    </button>
                  </Field>
                </>
              )}

              {/* 记住我 / 忘记密码 */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500 select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-teal-500 accent-teal-500"
                  />
                  记住我
                </label>
                <button
                  type="button"
                  className="text-sm text-teal-600 transition-colors hover:text-teal-700"
                >
                  忘记密码？
                </button>
              </div>

              {/* 协议 */}
              <div>
                <label className="flex cursor-pointer items-start gap-2 text-sm leading-relaxed text-gray-500 select-none">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked)
                      if (e.target.checked) setErrors((er) => ({ ...er, agreed: '' }))
                    }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-500 accent-teal-500"
                  />
                  <span>
                    我已阅读并同意
                    <button type="button" className="mx-1 text-teal-600 hover:underline">
                      《服务协议》
                    </button>
                    和
                    <button type="button" className="mx-1 text-teal-600 hover:underline">
                      《隐私政策》
                    </button>
                  </span>
                </label>
                {errors.agreed && <p className="mt-1.5 text-[13px] text-red-500">{errors.agreed}</p>}
              </div>

              {/* 提交 */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'group flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-lg shadow-teal-500/25 transition-all',
                  loading
                    ? 'cursor-wait bg-teal-400'
                    : 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:shadow-xl hover:shadow-teal-500/30 hover:brightness-105 active:scale-[0.99]',
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                    正在登录…
                  </>
                ) : (
                  <>
                    立即登录
                    <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-gray-400">
              还没有账号？
              <button
                type="button"
                className="ml-1 font-medium text-teal-600 transition-colors hover:text-teal-700"
              >
                申请开通账号
              </button>
            </p>

            {/* 演示账号提示 */}
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-[13px] leading-relaxed text-teal-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-medium">演示账号</span>（密码均为 123456）：
                PM 端 <code className="rounded bg-white px-1 font-mono">shilei</code> ，CRA 端{' '}
                <code className="rounded bg-white px-1 font-mono">zhanglan</code> ，后台管理端{' '}
                <code className="rounded bg-white px-1 font-mono">admin</code>
              </div>
            </div>
          </div>
        </div>

        {/* 底部 */}
        <footer className="flex flex-col items-center gap-1 px-6 pb-6 text-xs tracking-wide text-gray-400">
          <div>
            © <span className="font-num">2026</span> 乂氪医疗科技 · Clin X Trials
            临床研究运营平台 v1.0
          </div>
        </footer>
      </div>
    </div>
  )
}
