import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import Layout from '@/components/layout/Layout'
import { pagesForRole, homeOf, type PageKey } from '@/components/layout/Sidebar'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
import TmfPage from '@/pages/TmfPage'
import Submission from '@/pages/Submission'
import Transfer from '@/pages/Transfer'
import Review from '@/pages/Review'
import PdfPreview from '@/pages/PdfPreview'
import Favorite from '@/pages/Favorite'
import ExHome from '@/pages/executor/ExHome'
import ExSiteTmf from '@/pages/executor/ExSiteTmf'
import ExTransfer from '@/pages/executor/ExTransfer'
import ExSubmission from '@/pages/executor/ExSubmission'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminAccounts from '@/pages/admin/AdminAccounts'
import AdminCustomers from '@/pages/admin/AdminCustomers'
import AdminNaming from '@/pages/admin/AdminNaming'
import AdminAudit from '@/pages/admin/AdminAudit'
import { StoreProvider, useStore, type Role } from '@/store'
import { ThemeBgProvider } from '@/lib/theme'

const pageTitles: Record<PageKey, string> = {
  home: 'Home',
  submission: 'SUBMISSION',
  transfer: 'Transfer',
  review: 'REVIEW',
  study: 'STUDY TMF',
  site: 'SITE TMF',
  favorite: 'Favorite',
  dashboard: 'DASHBOARD',
  accounts: 'ACCOUNTS',
  customers: 'CUSTOMERS',
  naming: 'NAMING',
  audit: 'AUDIT',
}

const pageKeys = Object.keys(pageTitles) as PageKey[]

type View = { kind: 'page' } | { kind: 'pdf'; fileId: string }

/** 解析 hash；返回页面视图 + 是否越权访问 */
function parseHash(role: Role): { page: PageKey; view: View; denied: boolean } {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  const allowed = pagesForRole(role)
  const fallback = homeOf(role)
  if (raw === 'pdf') {
    if (role === 'pm') return { page: 'review', view: { kind: 'pdf', fileId: 'f3' }, denied: false }
    return { page: fallback, view: { kind: 'page' }, denied: true }
  }
  if ((pageKeys as string[]).includes(raw)) {
    if (allowed.includes(raw as PageKey)) {
      return { page: raw as PageKey, view: { kind: 'page' }, denied: false }
    }
    return { page: fallback, view: { kind: 'page' }, denied: true }
  }
  return { page: fallback, view: { kind: 'page' }, denied: false }
}

function Shell() {
  const { state } = useStore()
  const role = state.role
  const [page, setPage] = useState<PageKey>(() => parseHash(role).page)
  const [view, setView] = useState<View>(() => parseHash(role).view)
  const [denied] = useState(() => parseHash(role).denied)

  /* hash 直达无权限页面：toast 提示并回默认首页 */
  useEffect(() => {
    if (denied) {
      toast.error('无权限访问该页面')
      window.location.hash = `/${homeOf(role)}`
    }
  }, [denied, role])

  /* 角色变化兜底：若当前页面无权限则退回默认首页，并退出 PDF 预览 */
  useEffect(() => {
    if (!pagesForRole(role).includes(page)) {
      setPage(homeOf(role))
      window.location.hash = `/${homeOf(role)}`
    }
    setView((v) => (v.kind === 'pdf' && role !== 'pm' ? { kind: 'page' } : v))
  }, [role, page])

  const navigate = (key: PageKey) => {
    setPage(key)
    setView({ kind: 'page' })
    window.location.hash = `/${key}`
  }

  const openPdf = (fileId: string) => setView({ kind: 'pdf', fileId })

  const renderPage = () => {
    if (role === 'executor') {
      switch (page) {
        case 'home':
          return <ExHome />
        case 'submission':
          return <ExSubmission />
        case 'transfer':
          return <ExTransfer />
        case 'site':
          return <ExSiteTmf />
        case 'favorite':
          return <Favorite />
        default:
          return <ExHome />
      }
    }
    if (role === 'admin') {
      switch (page) {
        case 'dashboard':
          return <AdminDashboard />
        case 'accounts':
          return <AdminAccounts />
        case 'customers':
          return <AdminCustomers />
        case 'naming':
          return <AdminNaming />
        case 'audit':
          return <AdminAudit />
        default:
          return <AdminDashboard />
      }
    }
    switch (page) {
      case 'home':
        return <Home />
      case 'submission':
        return <Submission />
      case 'transfer':
        return <Transfer />
      case 'review':
        return <Review onOpenPdf={openPdf} />
      case 'study':
        return <TmfPage type="study" />
      case 'site':
        return <TmfPage type="site" />
      case 'favorite':
        return <Favorite />
    }
  }

  /* 页面标题英文统一全部大写 */
  const rawTitle = view.kind === 'pdf' ? 'REVIEW' : pageTitles[page]
  const displayTitle = rawTitle.toUpperCase()

  return (
    <Layout active={page} title={displayTitle} onNavigate={navigate}>
      {view.kind === 'pdf' ? (
        <PdfPreview fileId={view.fileId} onBack={() => setView({ kind: 'page' })} />
      ) : (
        renderPage()
      )}
    </Layout>
  )
}

/** 登录门控：未登录只渲染 Login 页（无侧边栏 / Header） */
function Root() {
  const { state } = useStore()
  if (!state.authed) return <Login />
  return <Shell />
}

export default function App() {
  return (
    <StoreProvider>
      <ThemeBgProvider>
        <Root />
        <Toaster position="top-center" richColors />
      </ThemeBgProvider>
    </StoreProvider>
  )
}
