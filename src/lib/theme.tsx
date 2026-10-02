import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/** 页面背景 + 导航栏背景偏好：用户可选预设或自定义颜色，持久化到 localStorage */
const BG_KEY = 'clinx-bg-v1'
const NAV_KEY = 'clinx-nav-bg-v1'

export const DEFAULT_BG = '#f3f5f9'
export const DEFAULT_NAV_BG =
  'linear-gradient(180deg, #14b8a6 0%, #0ea5a4 12%, #10b981 34%, #34c78e 48%, #3b82f6 78%, #4f46e5 100%)'

/** 预设页面背景色板（浅色为主，保证内容可读性） */
export const BG_PRESETS: { name: string; value: string }[] = [
  { name: '默认灰蓝', value: '#f3f5f9' },
  { name: '纯净白', value: '#ffffff' },
  { name: '薄荷青', value: '#eef7f5' },
  { name: '晴空蓝', value: '#eef4fb' },
  { name: '薰衣草', value: '#f3f1fa' },
  { name: '暖米白', value: '#faf7f2' },
  { name: '蜜桃粉', value: '#fdf3f0' },
  { name: '深空灰', value: '#e8eaef' },
]

/** 预设导航栏背景（深色低饱和渐变为主，与白字对比清晰） */
export const NAV_PRESETS: { name: string; value: string }[] = [
  { name: '默认青蓝', value: DEFAULT_NAV_BG },
  { name: '深空蓝', value: 'linear-gradient(180deg, #1e40af 0%, #1e3a8a 55%, #0e1d47 100%)' },
  { name: '石墨蓝灰', value: 'linear-gradient(180deg, #475569 0%, #334155 55%, #1e293b 100%)' },
  { name: '墨玉绿', value: 'linear-gradient(180deg, #256a5a 0%, #1c4f44 55%, #12332c 100%)' },
  { name: '藏青', value: 'linear-gradient(180deg, #22336b 0%, #1a2750 55%, #101a36 100%)' },
  { name: '暮山紫', value: 'linear-gradient(180deg, #655b93 0%, #4f4675 55%, #373051 100%)' },
  { name: '曜石黑', value: 'linear-gradient(180deg, #39404e 0%, #262b35 55%, #15181e 100%)' },
  { name: '檀色', value: 'linear-gradient(180deg, #835046 0%, #673d35 55%, #472a24 100%)' },
]

/** 由单色生成纵向渐变（顶部原色 → 底部加深 30%） */
function gradientFrom(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(v * 0.7)
  const dark = `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
  return `linear-gradient(180deg, ${hex} 0%, ${dark} 100%)`
}

/** 取渐变的起始色用于色值显示/取色器回填 */
export function navBaseColor(navBg: string): string {
  const m = navBg.match(/#[0-9a-fA-F]{6}/)
  return m ? m[0] : '#14b8a6'
}

function readColor(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return raw
  } catch {
    /* localStorage 不可用时用默认值 */
  }
  return fallback
}

const ThemeBgContext = createContext<{
  bg: string
  setBg: (c: string) => void
  navBg: string
  setNavBg: (c: string) => void
}>({ bg: DEFAULT_BG, setBg: () => {}, navBg: DEFAULT_NAV_BG, setNavBg: () => {} })

export function ThemeBgProvider({ children }: { children: ReactNode }) {
  const [bg, setBgState] = useState<string>(() => readColor(BG_KEY, DEFAULT_BG))
  const [navBg, setNavBgState] = useState<string>(() => readColor(NAV_KEY, DEFAULT_NAV_BG))

  const persist = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* 忽略 */
    }
  }

  const setBg = (c: string) => {
    setBgState(c)
    persist(BG_KEY, c)
  }

  /** 传纯色时自动生成渐变，传渐变串则直接使用 */
  const setNavBg = (c: string) => {
    const v = c.startsWith('linear-gradient') ? c : gradientFrom(c)
    setNavBgState(v)
    persist(NAV_KEY, v)
  }

  /* 页面背景同步到 body，滚动溢出区域也一致 */
  useEffect(() => {
    document.body.style.backgroundColor = bg
    return () => {
      document.body.style.backgroundColor = ''
    }
  }, [bg])

  return (
    <ThemeBgContext.Provider value={{ bg, setBg, navBg, setNavBg }}>
      {children}
    </ThemeBgContext.Provider>
  )
}

export function useThemeBg() {
  return useContext(ThemeBgContext)
}
