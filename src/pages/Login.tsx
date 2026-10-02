import { useState, type FormEvent } from 'react'
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  FolderArchive,
  Sparkles,
  ClipboardCheck,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore, type Role } from '@/store'
import BrandMark from '@/components/BrandMark'

/* ---------------- 左侧品牌区：三条系统特点 ---------------- */

const features = [
  {
    icon: FolderArchive,
    title: 'TMF 文档全流程管理',
    desc: '目录配置 · 版本管理 · 归档路由一站完成',
    iconCls: 'from-teal-400 to-emerald-500 shadow-teal-500/25',
  },
  {
    icon: Sparkles,
    title: '智能命名 · 自动归档',
    desc: '上传即按规则命名 · 审核通过自动归档至目标目录',
    iconCls: 'from-cyan-400 to-teal-600 shadow-cyan-500/25',
  },
  {
    icon: ClipboardCheck,
    title: '多中心文件实时质控',
    desc: '审核 · 驳回 · 递交全程留痕可溯',
    iconCls: 'from-sky-400 to-blue-600 shadow-sky-500/25',
  },
]

/* ---------------- 输入框（R40：胶囊形 rounded-full、图标内嵌、去独立 label 改占位符文案） ---------------- */

function Field({
  icon: Icon,
  error,
  children,
}: {
  icon: typeof User
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-full border bg-white px-5 transition-all focus-within:border-teal-400 focus-within:shadow-[0_0_0_4px_rgba(45,212,191,0.14)]',
          error ? 'border-red-300' : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <Icon className="h-5 w-5 shrink-0 text-gray-400 transition-colors group-focus-within:text-teal-500" />
        {children}
      </div>
      {error && <p className="mt-1.5 pl-5 text-[13px] text-red-500">{error}</p>}
    </div>
  )
}

const inputCls =
  'h-11 w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400'

/* ---------------- 左下品牌主视觉：TMF 文档流转示意（纯 CSS/SVG） ---------------- */

function DocFlowVisual() {
  return (
    <div aria-hidden className="relative mt-8 hidden h-[120px] max-w-[480px] select-none lg:block 2xl:mt-10 2xl:h-[145px] 2xl:max-w-[540px]">
      {/* 柔和底光 */}
      <div className="absolute inset-x-8 top-4 bottom-0 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.12),transparent_70%)] blur-xl" />

      {/* 流转动线：上传 → 审核 → 归档（虚线流动，复用 login-ekg 描边动画） */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 580 212" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="loginFlowGrad" x1="0" y1="0" x2="580" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2dd4bf" />
            <stop offset="0.55" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        {/* 辉光底层 */}
        <path
          d="M 18 158 C 130 112, 214 182, 302 144 C 382 110, 472 96, 562 118"
          stroke="rgba(45,212,191,0.14)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* 流动虚线 */}
        <path
          className="login-ekg"
          d="M 18 158 C 130 112, 214 182, 302 144 C 382 110, 472 96, 562 118"
          stroke="url(#loginFlowGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 9"
        />
        {/* 三个节点：外环 + 内芯 */}
        {[
          [46, 150],
          [300, 143],
          [538, 116],
        ].map(([cx, cy]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r="10" fill="white" stroke="url(#loginFlowGrad)" strokeWidth="1.6" />
            <circle cx={cx} cy={cy} r="3.6" fill="#14b8a6" />
          </g>
        ))}
        {/* 数据流粒子 */}
        <circle cx="170" cy="133" r="2.6" fill="#22d3ee" opacity="0.85" />
        <circle cx="392" cy="112" r="2.2" fill="#2dd4bf" opacity="0.7" />
        <circle cx="470" cy="103" r="2.8" fill="#38bdf8" opacity="0.8" />
      </svg>

      {/* 节点标签 */}
      <span className="absolute top-[79%] left-[3%] rounded-full bg-white/75 px-2.5 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-100 backdrop-blur-sm">
        上传
      </span>
      <span className="absolute top-[76%] left-[47.5%] rounded-full bg-white/75 px-2.5 py-0.5 text-[11px] font-medium text-cyan-700 ring-1 ring-cyan-100 backdrop-blur-sm">
        审核
      </span>
      <span className="absolute top-[64%] right-[0.5%] rounded-full bg-white/75 px-2.5 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-100 backdrop-blur-sm">
        归档
      </span>

      {/* 堆叠底层卡（纵深感） */}
      <div className="login-fade-up absolute top-0 left-[13%]" style={{ animationDelay: '0.5s' }}>
        <div className="w-40 -rotate-6 scale-[0.93] rounded-xl bg-white/55 p-3 opacity-60 shadow-md ring-1 ring-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-gray-200/80" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-3/4 rounded-full bg-gray-200/90" />
              <div className="h-2 w-1/2 rounded-full bg-gray-100" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-gray-100" />
            <div className="h-1.5 w-4/6 rounded-full bg-gray-100" />
          </div>
        </div>
      </div>

      {/* 文档卡 A：审批中 */}
      <div className="login-fade-up absolute top-1 left-[15%]" style={{ animationDelay: '0.42s' }}>
        <div
          className="login-float w-40 rounded-xl bg-white/70 p-3 shadow-[0_12px_32px_-12px_rgba(15,118,110,0.2)] ring-1 ring-white/70 backdrop-blur-md"
          style={{ '--login-tilt': '-2deg' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 shadow-sm" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-3/4 rounded-full bg-gray-200" />
              <div className="h-2 w-1/2 rounded-full bg-gray-100" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-gray-100" />
            <div className="h-1.5 w-5/6 rounded-full bg-gray-100" />
            <div className="h-1.5 w-2/3 rounded-full bg-gray-100" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="h-1.5 w-10 rounded-full bg-gray-200" />
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-amber-200/80">
              审批中
            </span>
          </div>
        </div>
      </div>

      {/* 版本小芯片（点缀） */}
      <div className="login-fade-up absolute top-0 left-[47%]" style={{ animationDelay: '0.56s' }}>
        <div
          className="login-float rounded-lg bg-white/80 px-2 py-1 font-mono text-[10px] font-semibold text-cyan-600 shadow-md ring-1 ring-cyan-100 backdrop-blur-sm"
          style={{ animationDelay: '0.7s', '--login-tilt': '3deg' } as React.CSSProperties}
        >
          V3.0
        </div>
      </div>

      {/* 文档卡 B：已归档 */}
      <div className="login-fade-up absolute top-4 right-[9%]" style={{ animationDelay: '0.64s' }}>
        <div
          className="login-float w-40 rounded-xl bg-white/70 p-3 shadow-[0_12px_32px_-12px_rgba(8,145,178,0.18)] ring-1 ring-white/70 backdrop-blur-md"
          style={{ animationDelay: '1.3s', '--login-tilt': '1.5deg' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-sky-500 text-white shadow-sm">
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-2/3 rounded-full bg-gray-200" />
              <div className="h-2 w-1/2 rounded-full bg-gray-100" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-gray-100" />
            <div className="h-1.5 w-4/6 rounded-full bg-gray-100" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="h-1.5 w-10 rounded-full bg-gray-200" />
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-600 ring-1 ring-teal-200/80">
              已归档
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

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
      {/* 背景第一层：细网格纹理（边缘渐隐） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,118,110,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(15,118,110,0.055) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          WebkitMaskImage:
            'radial-gradient(ellipse 95% 90% at 50% 42%, black 55%, transparent 100%)',
          maskImage: 'radial-gradient(ellipse 95% 90% at 50% 42%, black 55%, transparent 100%)',
        }}
      />
      {/* 背景第二层：渐变光斑（R40：右上/中部补紫罗兰光晕，克制不抢戏） */}
      <div className="pointer-events-none absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-teal-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/4 -right-32 h-[26rem] w-[26rem] rounded-full bg-violet-200/45 blur-3xl" />
      <div className="pointer-events-none absolute top-[6%] right-[24%] hidden h-72 w-72 rounded-full bg-violet-200/30 blur-3xl lg:block" />
      <div className="pointer-events-none absolute top-1/3 right-[8%] h-80 w-80 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-[36%] h-[22rem] w-[22rem] rounded-full bg-sky-200/30 blur-3xl" />
      {/* 背景第三层：描边空心大水印（与内容呼应，不压文字） */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-14 -left-4 hidden text-[12rem] leading-none font-black tracking-tighter select-none lg:block"
        style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(15,118,110,0.13)' }}
      >
        eTMF
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-24 right-[30%] hidden text-[7rem] leading-none font-black tracking-tighter select-none lg:block"
        style={{ color: 'transparent', WebkitTextStroke: '1.2px rgba(8,145,178,0.11)' }}
      >
        GCP
      </div>

      {/* 顶部一行：左侧品牌字标（R41 描边空心渐变字 + 角框 + 微笑弧线）+ 竖向修饰线 + 系统名/英文渐变大写副标题（右上角留空） */}
      <header className="relative z-10 flex items-center px-5 py-3 sm:px-10 sm:py-3.5">
        <BrandMark className="h-9 w-auto sm:h-11" />
        <div aria-hidden className="mx-3 h-7 w-px bg-gray-300/90 sm:mx-4 sm:h-9" />
        <div>
          <div className="text-base font-bold tracking-wide text-[#182838] sm:text-lg">
            研究文件管理系统
          </div>
          <div className="mt-0.5 bg-gradient-to-r from-teal-500 to-violet-500 bg-clip-text text-[9px] font-semibold tracking-[0.18em] text-transparent uppercase sm:text-[10px]">
            Document Management System
          </div>
        </div>
      </header>

      {/* 主体：左右分栏（窄屏堆叠，品牌区精简）；R41 整页一屏零滚动——各区间距收紧 */}
      <main className="relative z-10 flex flex-1 flex-col items-center gap-8 px-5 pb-2 sm:px-10 lg:flex-row lg:items-center lg:gap-6">
        {/* 左侧品牌区（约 55% 宽） */}
        <section className="w-full pt-2 lg:w-[55%] lg:pt-0 lg:pl-8 xl:pl-16">
          <div className="login-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-teal-700 shadow-[0_10px_28px_-10px_rgba(15,118,110,0.3)] ring-1 ring-gray-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              智能一体化临床研究文件管理平台
            </span>
          </div>

          <div className="login-fade-up mt-4" style={{ animationDelay: '0.08s' }}>
            {/* R41 主标题降档：克制的中等字号（2xl→3xl、font-bold），两行间距收敛 */}
            <h1 className="text-2xl font-bold tracking-wide sm:text-3xl">
              {/* 两行拉开行距；第一行深青墨绿（参考图取色 #134e4a 一类深 teal） */}
              <span className="block leading-snug text-[#134e4a]">以智能科技 · 赋能科研创新</span>
              {/* 第二行青→蓝绿渐变（原图取色 #28d0c8 → #30c0f0） */}
              <span className="mt-2 block bg-gradient-to-r from-[#28d0c8] to-[#30c0f0] bg-clip-text leading-snug text-transparent sm:mt-2.5">
                让研究轻松前行
              </span>
            </h1>
            {/* 科技感修饰光带：渐变细直条 + 荧光辉光 + 左端渐变方块起笔（宽度匹配新字号） */}
            <div aria-hidden className="mt-3 flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-[3px] bg-gradient-to-br from-[#28d0c8] to-[#30c0f0] shadow-[0_0_8px_rgba(48,192,240,0.7)]" />
              <span className="h-[3px] w-[220px] rounded-full bg-gradient-to-r from-[#28d0c8] to-[#30c0f0] shadow-[0_0_10px_rgba(44,204,216,0.6),0_0_22px_rgba(48,192,240,0.3)] sm:w-[260px]" />
            </div>
          </div>

          {/* 三条系统特点（R40 白卡版；R41 回调更紧凑：图标方块缩小、标题 text-sm、描述 text-xs、卡 padding 缩小；
              窄屏隐藏，精简品牌区） */}
          <ul className="mt-8 hidden max-w-md space-y-3 lg:block 2xl:mt-9">
            {features.map(({ icon: Icon, title, desc, iconCls }, i) => (
              <li
                key={title}
                className="login-fade-up flex items-center gap-3.5 rounded-2xl bg-white p-3.5 shadow-[0_14px_36px_-16px_rgba(15,118,110,0.18)] ring-1 ring-gray-100/90"
                style={{ animationDelay: `${0.24 + i * 0.1}s` }}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md',
                    iconCls,
                  )}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-800">{title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-gray-500">{desc}</div>
                </div>
              </li>
            ))}
          </ul>

          {/* 品牌主视觉：TMF 文档流转示意（窄屏精简隐藏） */}
          <DocFlowVisual />
        </section>

        {/* 右侧登录卡片（R40 确立：白实底/大圆角/居中/胶囊输入框/紫→teal 渐变按钮；
            R41 回调：宽度 440→400、padding/间距/字号整体收小，配合整页零滚动） */}
        <section className="flex w-full justify-center lg:w-[45%] lg:justify-end lg:pr-8 xl:pr-16">
          <div
            className="login-fade-up relative w-full max-w-[400px] rounded-[1.75rem] bg-white p-7 shadow-[0_28px_72px_-20px_rgba(15,118,110,0.28)] ring-1 ring-gray-100 sm:p-8"
            style={{ animationDelay: '0.12s' }}
          >
            {/* 顶部紫→teal 渐变细边（参照图卡片顶边） */}
            <div
              aria-hidden
              className="absolute inset-x-8 top-0 h-[3px] rounded-full bg-gradient-to-r from-violet-400 via-sky-400 to-teal-400"
            />
            {/* eTMF 徽标保留（右上） */}
            <span className="absolute top-5 right-6 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-teal-600 ring-1 ring-teal-100">
              eTMF
            </span>
            {/* 卡片头部：居中品牌字标（描边渐变 + 角框 + 弧线） */}
            <div className="flex justify-center">
              <BrandMark className="h-8 w-auto" />
            </div>

            <h2 className="mt-4 text-center text-xl font-bold tracking-wide text-gray-900">欢迎登录</h2>
            <p className="mt-1 text-center text-xs tracking-wide text-gray-400">Document Management System</p>

            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              <Field icon={Mail} error={errors.account}>
                <input
                  className={inputCls}
                  placeholder="登录账号 / 邮箱"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  autoComplete="username"
                />
              </Field>
              <Field icon={Lock} error={errors.password}>
                <input
                  className={inputCls}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="登录密码"
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
                  'group flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white shadow-[0_14px_32px_-12px_rgba(139,92,246,0.45)] transition-all',
                  loading
                    ? 'cursor-wait bg-teal-400'
                    : 'bg-gradient-to-r from-[#a78bfa] via-[#60a5fa] to-[#2dd4bf] hover:shadow-[0_20px_44px_-12px_rgba(45,212,191,0.5)] hover:brightness-105 active:scale-[0.99]',
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

            {/* 演示账号提示（保留，样式收敛） */}
            <div className="mt-5 border-t border-gray-100 pt-3.5 text-center text-[11px] leading-relaxed text-gray-400">
              <div className="mb-1">演示账号（密码均为 123456）</div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
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
      <footer className="relative z-10 pb-3 text-center text-[11px] tracking-wide text-gray-400">
        © <span className="font-num">2026</span> 乂氪医疗科技 · Clin X Trials 研究文件管理系统 v1.0
      </footer>
    </div>
  )
}
