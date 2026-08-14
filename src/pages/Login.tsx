import { useState, type FormEvent } from 'react'
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  FolderArchive,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore, type Role } from '@/store'
import logoImg from '@/assets/clini-x-trials-logo.png'

/* ---------------- 左侧品牌区：三条系统特点 ---------------- */

const features = [
  {
    icon: FolderArchive,
    title: 'TMF 文档全流程管理',
    desc: '目录配置 · 版本管理 · 归档路由一站完成',
    iconCls: 'bg-teal-100 text-teal-600',
  },
  {
    icon: Sparkles,
    title: '智能命名 · 自动归档',
    desc: '上传即按规则命名 · 审核通过自动归档至目标目录',
    iconCls: 'bg-cyan-100 text-cyan-600',
  },
  {
    icon: ClipboardCheck,
    title: '多中心文件实时质控',
    desc: '审核 · 驳回 · 递交全程留痕可溯',
    iconCls: 'bg-blue-100 text-blue-600',
  },
]

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
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}

    let role: Role = 'pm'
    let loginUser = ''
    let loginName = ''
    if (!account.trim()) errs.account = '请输入账号'
    if (!password) errs.password = '请输入登录密码'
    if (!errs.account && !errs.password) {
      /* 真实校验：账号支持用户名 / 姓名 / 邮箱，对账户体系校验 */
      const hit = state.accounts.find(
        (a) =>
          (a.username === account.trim() ||
            a.name === account.trim() ||
            a.email === account.trim()) &&
          a.password === password,
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

    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    setTimeout(() => dispatch({ type: 'login', role, username: loginUser, name: loginName }), 900)
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #f0fdfa 0%, #f8fafc 38%, #ecfeff 68%, #eff6ff 100%)',
      }}
    >
      {/* 左侧大字水印装饰 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -left-6 hidden text-[11rem] leading-none font-black tracking-tighter text-teal-900/[0.05] select-none lg:block"
      >
        eTMF
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-24 right-[38%] hidden text-[7rem] leading-none font-black tracking-tighter text-cyan-900/[0.04] select-none lg:block"
      >
        GCP
      </div>
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl" />

      {/* 顶部一行：左侧 LOGO + 竖向修饰线 + 系统名/英文副标题（右上角留空） */}
      <header className="relative z-10 flex items-center px-6 py-5 sm:px-10">
        <img src={logoImg} alt="CLINI X TRIALS" className="h-10 w-auto sm:h-12" />
        <div aria-hidden className="mx-4 h-9 w-px bg-gray-300/90 sm:h-10" />
        <div>
          <div className="text-lg font-bold tracking-wide text-[#182838]">研究文件管理系统</div>
          <div className="mt-0.5 text-[11px] tracking-wider text-gray-400">
            Clinical Trial Document Management System
          </div>
        </div>
      </header>

      {/* 主体：左右分栏（窄屏堆叠，品牌区精简） */}
      <main className="relative z-10 flex flex-1 flex-col items-center gap-10 px-6 pb-10 sm:px-10 lg:flex-row lg:items-center lg:gap-6">
        {/* 左侧品牌区（约 55% 宽） */}
        <section className="w-full pt-4 lg:w-[55%] lg:pt-0 lg:pl-6 xl:pl-14">
          <div className="login-fade-up">
            <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-600">
              智能一体化临床研究文件管理平台
            </span>
          </div>

          <div className="login-fade-up mt-6" style={{ animationDelay: '0.08s' }}>
            <h1 className="text-4xl font-bold tracking-wide sm:text-5xl">
              {/* 两行拉开行距；第一行深青墨绿（参考图取色 #134e4a 一类深 teal） */}
              <span className="block leading-normal text-[#134e4a]">以智能科技 · 赋能科研创新</span>
              {/* 第二行青→蓝绿渐变（原图取色 #28d0c8 → #30c0f0） */}
              <span className="mt-3 block bg-gradient-to-r from-[#28d0c8] to-[#30c0f0] bg-clip-text leading-normal text-transparent sm:mt-4">
                让研究轻松前行
              </span>
            </h1>
            {/* 科技感修饰光带：渐变细直条 + 荧光辉光 + 左端渐变方块起笔（宽度略短于文字） */}
            <div aria-hidden className="mt-4 flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-[3px] bg-gradient-to-br from-[#28d0c8] to-[#30c0f0] shadow-[0_0_8px_rgba(48,192,240,0.7)]" />
              <span className="h-[3px] w-[300px] rounded-full bg-gradient-to-r from-[#28d0c8] to-[#30c0f0] shadow-[0_0_10px_rgba(44,204,216,0.6),0_0_22px_rgba(48,192,240,0.3)] sm:w-[340px]" />
            </div>
          </div>

          <p
            className="login-fade-up mt-5 max-w-xl text-[15px] leading-relaxed text-gray-500"
            style={{ animationDelay: '0.16s' }}
          >
            义氪专注于临床研究数字化，以一体化文档管理矩阵与灵活的定制化开发能力，助力药企、CRO
            与医疗机构实现研究文件的标准化、可追溯管理。
          </p>

          {/* 三条系统特点（窄屏隐藏，精简品牌区） */}
          <ul className="mt-10 hidden space-y-5 lg:block">
            {features.map(({ icon: Icon, title, desc, iconCls }, i) => (
              <li
                key={title}
                className="login-fade-up flex items-center gap-4"
                style={{ animationDelay: `${0.24 + i * 0.1}s` }}
              >
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    iconCls,
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-base font-semibold text-gray-800">{title}</div>
                  <div className="mt-0.5 text-sm text-gray-400">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 右侧登录卡片（约 400px 宽） */}
        <section className="flex w-full justify-center lg:w-[45%] lg:justify-end lg:pr-6 xl:pr-14">
          <div
            className="login-fade-up w-full max-w-[400px] rounded-3xl bg-white p-8 shadow-xl shadow-teal-900/[0.07] ring-1 ring-gray-100"
            style={{ animationDelay: '0.12s' }}
          >
            <h2 className="text-2xl font-bold tracking-wide text-gray-900">欢迎登录</h2>
            <p className="mt-1.5 text-sm text-gray-400">请使用账号密码登录研究文件管理系统</p>

            <form onSubmit={submit} noValidate className="mt-7 space-y-5">
              <Field label="账号" icon={User} error={errors.account}>
                <input
                  className={inputCls}
                  placeholder="请输入邮箱或用户名"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  autoComplete="username"
                />
              </Field>
              <Field label="密码" icon={Lock} error={errors.password}>
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
                  {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </Field>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'group flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-lg shadow-teal-500/25 transition-all',
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
                    登 录
                    <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* 演示账号提示 */}
            <div className="mt-7 border-t border-gray-100 pt-5 text-xs leading-relaxed text-gray-400">
              <div className="mb-1.5 font-medium text-gray-500">演示账号（密码均为 123456）</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  管理端 <code className="rounded bg-gray-50 px-1 font-mono text-gray-500">admin</code>
                </span>
                <span>
                  PM 端 <code className="rounded bg-gray-50 px-1 font-mono text-gray-500">shilei</code>
                </span>
                <span>
                  CRA 端{' '}
                  <code className="rounded bg-gray-50 px-1 font-mono text-gray-500">zhanglan</code>
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 底部 */}
      <footer className="relative z-10 pb-5 text-center text-xs tracking-wide text-gray-400">
        © <span className="font-num">2026</span> 乂氪医疗科技 · Clin X Trials 研究文件管理系统 v1.0
      </footer>
    </div>
  )
}
