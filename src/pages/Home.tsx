import { useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Upload, ScanSearch, FileX, FolderArchive, UserRoundPlus, ArrowUp, ArrowDown, Plus, Hospital, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageCard, DataTable, Th, Td, Tr, ToolbarSelect, TealLink } from '@/components/common'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { projectOptions, siteOptions, barSeries, type StatIconKey } from '@/data/mock'
import { useStore, statsByCenter, craNameOf, projPrefixMatch, pmOfProject, nextId, PM_USER, type TmfFile, type Catalog, type Center } from '@/store'

const statIcons: Record<StatIconKey, typeof Upload> = {
  upload: Upload,
  scan: ScanSearch,
  filex: FileX,
  archive: FolderArchive,
}

/* ---------- 从 store 派生首页统计（子文件不重复计数；只统计具体文件，kind='folder' 的文件夹不计入） ---------- */

/** 筛选器「全部」选项值 */
const ALL = '全部'
const projectFilterOptions = [{ label: ALL, value: ALL }, ...projectOptions]
const siteFilterOptions = [{ label: ALL, value: ALL }, ...siteOptions]

/** 全局项目筛选：读写 store.activeProject，与顶部 Header 项目下拉联动 */
function useGlobalProject() {
  const { state, dispatch } = useStore()
  return [state.activeProject, (p: string) => dispatch({ type: 'setActiveProject', project: p })] as const
}

interface HomeFilter {
  project?: string
  center?: string
}

interface HomeStats {
  donut: { name: string; value: number; color: string }[]
  cards: { label: string; value: number; color: string; icon: StatIconKey }[]
  monthly: { month: string; upload: number; pending: number; rejected: number; archived: number }[]
  siteMonthly: { month: string; upload: number; pending: number; rejected: number; archived: number }[]
  studyRows: { project: string; upload: number; archived: number }[]
}

function deriveHomeStats(files: TmfFile[], catalogs: Catalog[], filter: HomeFilter = {}): HomeStats {
  const tops = files.filter((f) => {
    if (f.parentId) return false
    /* 口径：只统计具体文件，Excel 导入生成的空文件夹（kind='folder'）不计入上传/归档/环比等任何统计 */
    if (f.kind === 'folder') return false
    if (filter.project && filter.project !== ALL && !f.projectNo.startsWith(filter.project)) return false
    if (filter.center && filter.center !== ALL && f.center !== filter.center) return false
    return true
  })
  const studyCatIds = new Set(catalogs.filter((c) => c.kind === 'study').map((c) => c.id))
  /* STUDY 归属：已归档看目录类型，未归档按 PM 上传判定；其余为 SITE 归属 */
  const studyBound = tops.filter((f) => (f.folderId ? studyCatIds.has(f.folderId) : f.uploader === PM_USER.name))
  const siteBound = tops.filter((f) => !studyBound.includes(f))

  /* 环形图：PM 看 STUDY 归属文件；执行端无 STUDY 文件时回退为本人上传/归档 */
  const donutBase = studyBound.length > 0 ? studyBound : tops
  const donut = [
    { name: '上传', value: donutBase.length, color: '#3b82f6' },
    { name: '归档', value: donutBase.filter((f) => f.status === 'archived').length, color: '#14b8a6' },
  ]

  const cards = [
    { label: '上传文件', value: siteBound.length, color: '#14b8a6', icon: 'upload' as StatIconKey },
    { label: '待审核文件', value: siteBound.filter((f) => f.status === 'pending').length, color: '#f97316', icon: 'scan' as StatIconKey },
    { label: '驳回文件', value: siteBound.filter((f) => f.status === 'rejected').length, color: '#f43f5e', icon: 'filex' as StatIconKey },
    { label: '归档文件', value: siteBound.filter((f) => f.status === 'archived').length, color: '#8b5cf6', icon: 'archive' as StatIconKey },
  ]

  const byMonth = new Map<string, { month: string; upload: number; pending: number; rejected: number; archived: number }>()
  for (const f of tops) {
    const month = f.uploadDate.slice(0, 7)
    const row = byMonth.get(month) ?? { month, upload: 0, pending: 0, rejected: 0, archived: 0 }
    row.upload += 1
    if (f.status === 'pending') row.pending += 1
    if (f.status === 'rejected') row.rejected += 1
    if (f.status === 'archived') row.archived += 1
    byMonth.set(month, row)
  }
  const monthly = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))

  /* SITE 归属文件按月聚合（状态卡「较上月」环比用，随项目筛选联动） */
  const siteByMonth = new Map<string, { month: string; upload: number; pending: number; rejected: number; archived: number }>()
  for (const f of siteBound) {
    const month = f.uploadDate.slice(0, 7)
    const row = siteByMonth.get(month) ?? { month, upload: 0, pending: 0, rejected: 0, archived: 0 }
    row.upload += 1
    if (f.status === 'pending') row.pending += 1
    if (f.status === 'rejected') row.rejected += 1
    if (f.status === 'archived') row.archived += 1
    siteByMonth.set(month, row)
  }
  const siteMonthly = [...siteByMonth.values()].sort((a, b) => a.month.localeCompare(b.month))

  const byProject = new Map<string, { project: string; upload: number; archived: number }>()
  for (const f of studyBound) {
    const row = byProject.get(f.projectNo) ?? { project: f.projectNo, upload: 0, archived: 0 }
    row.upload += 1
    if (f.status === 'archived') row.archived += 1
    byProject.set(f.projectNo, row)
  }
  const studyRows = [...byProject.values()].sort((a, b) => a.project.localeCompare(b.project))

  return { donut, cards, monthly, siteMonthly, studyRows }
}

/** 首页统计作用域：PM 传全部文件，执行人员只传自己的文件；filter 为卡片级筛选 */
function useHomeStats(files?: TmfFile[], filter: HomeFilter = {}): HomeStats {
  const { state } = useStore()
  const { project, center } = filter
  return useMemo(
    () => deriveHomeStats(files ?? state.files, state.catalogs, { project, center }),
    [files, state.files, state.catalogs, project, center],
  )
}

export function StudyDonutCard({ files }: { files?: TmfFile[] }) {
  const [project, setProject] = useGlobalProject()
  const { donut } = useHomeStats(files, { project })
  const total = donut.reduce((s, d) => s + d.value, 0)
  const archived = donut.find((d) => d.name === '归档')?.value ?? 0
  const rate = total > 0 ? Math.round((archived / total) * 100) : 0
  return (
    <PageCard
      title="STUDY TMF"
      className="col-span-1 flex flex-col"
      bodyClassName="flex flex-1 flex-col items-center justify-center"
      extra={<ToolbarSelect value={project} onChange={setProject} options={projectFilterOptions} />}
    >
      <div className="relative">
        <PieChart width={216} height={216}>
          <Pie
            data={donut}
            dataKey="value"
            nameKey="name"
            cx={108}
            cy={108}
            innerRadius={68}
            outerRadius={94}
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            cornerRadius={4}
            paddingAngle={total > 0 ? 2 : 0}
            isAnimationActive={false}
          >
            {donut.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
        {/* 中心汇总：归档率 + 文件总数 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] leading-none font-bold text-gray-800">{rate}%</span>
          <span className="mt-1.5 text-[11px] text-gray-400">归档率</span>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4">
        {donut.map((d) => (
          <span
            key={d.name}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-gray-600"
            style={{ backgroundColor: `${d.color}14` }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name}
            <span className="font-semibold text-gray-800">{d.value}</span>
          </span>
        ))}
      </div>
    </PageCard>
  )
}

export function SiteStatCards({ files }: { files?: TmfFile[] }) {
  const [project, setProject] = useGlobalProject()
  const { cards, siteMonthly } = useHomeStats(files, { project })
  const totalUpload = cards[0]?.value ?? 0
  /* 「较上月」环比：trendKeys 与 cards 四项一一对应；不足两个月或上月为 0 时趋势为 null */
  const trendKeys = ['upload', 'pending', 'rejected', 'archived'] as const
  const curMonth = siteMonthly[siteMonthly.length - 1]
  const prevMonth = siteMonthly[siteMonthly.length - 2]
  const trends = trendKeys.map((k) =>
    !curMonth || !prevMonth || prevMonth[k] === 0
      ? null
      : Math.round(((curMonth[k] - prevMonth[k]) / prevMonth[k]) * 100),
  )
  return (
    <PageCard
      title="SITE TMF"
      className="col-span-2 flex flex-col"
      bodyClassName="flex-1"
      extra={<ToolbarSelect value={project} onChange={setProject} options={projectFilterOptions} />}
    >
      <div className="grid h-full grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = statIcons[card.icon]
          /* 占比条：上传卡为基数 100%，其余按占上传量的比例 */
          const ratio = i === 0 ? 1 : totalUpload > 0 ? card.value / totalUpload : 0
          const trend = trends[i] ?? null
          return (
            <div
              key={card.label}
              className="flex h-full flex-col justify-between rounded-xl p-5 ring-1 ring-gray-100/60"
              style={{ backgroundColor: `${card.color}0d` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-gray-400">{card.label}</div>
                  <div className="mt-2 text-[30px] leading-none font-semibold text-gray-800">
                    {card.value}
                    <span className="ml-1 text-xs font-normal text-gray-400">个</span>
                  </div>
                </div>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
                  style={{ backgroundColor: card.color }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="mt-5">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(ratio * 100, card.value > 0 ? 6 : 0)}%`, backgroundColor: card.color }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                  <span>{i === 0 ? '实时统计' : `占上传 ${Math.round(ratio * 100)}%`}</span>
                  {trend === null ? (
                    <span className="text-[11px] text-gray-300">较上月 —</span>
                  ) : trend === 0 ? (
                    <span className="text-[11px] text-gray-400">较上月 0%</span>
                  ) : (
                    <span
                      className={cn(
                        'flex items-center gap-0.5 text-[11px] font-medium',
                        i === 2
                          ? trend > 0
                            ? 'text-rose-500'
                            : 'text-teal-600'
                          : trend > 0
                            ? 'text-teal-600'
                            : 'text-gray-400',
                      )}
                    >
                      {trend > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      较上月 {trend > 0 ? `+${trend}` : trend}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </PageCard>
  )
}

export function SummaryBarCard({ files }: { files?: TmfFile[] }) {
  const [project, setProject] = useGlobalProject()
  const [site, setSite] = useState(ALL)
  const { monthly } = useHomeStats(files, { project, center: site })
  return (
    <PageCard
      title="统计汇总"
      extra={
        <div className="flex items-center gap-3">
          <ToolbarSelect value={project} onChange={setProject} options={projectFilterOptions} />
          <ToolbarSelect value={site} onChange={setSite} options={siteFilterOptions} />
        </div>
      }
    >
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={5} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#f0f1f5" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(20,184,166,0.05)' }} />
            {barSeries.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* 图例：与环形图一致的同色浅色胶囊 */}
      <div className="mt-4 flex items-center justify-center gap-4">
        {barSeries.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-gray-600"
            style={{ backgroundColor: `${s.color}14` }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </PageCard>
  )
}

function BottomTabsCard() {
  const [tab, setTab] = useState<'study' | 'site'>('study')
  const [project, setProject] = useGlobalProject()
  const { state } = useStore()
  const { studyRows } = useHomeStats(undefined, { project })
  const siteRows = useMemo(
    () =>
      statsByCenter(
        project === ALL ? state.files : state.files.filter((f) => f.projectNo.startsWith(project)),
      ),
    [state.files, project],
  )

  return (
    <PageCard bodyClassName="pt-1" className="pt-4">
      <div className="mb-2 flex items-center justify-between border-b border-gray-100">
        <div className="flex gap-7">
          {(
            [
              { key: 'study', label: 'STUDY TMF' },
              { key: 'site', label: 'SITE TMF' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'relative pb-3 text-sm transition-colors',
                tab === t.key
                  ? 'font-medium text-teal-600 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-teal-500'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'site' && (
          <div className="pb-2">
            <ToolbarSelect value={project} onChange={setProject} options={projectFilterOptions} />
          </div>
        )}
      </div>

      {tab === 'study' ? (
        <DataTable className="mt-2">
          <thead>
            <tr>
              <Th sortable={false}>研究编号</Th>
              <Th sortable={false}>项目经理</Th>
              <Th sortable={false}>上传</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {studyRows.map((r) => (
              <Tr key={r.project}>
                <Td>{r.project}</Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-medium text-teal-600">
                      {pmOfProject(state.pmMap, r.project).slice(0, 1)}
                    </span>
                    {pmOfProject(state.pmMap, r.project)}
                  </span>
                </Td>
                <Td>{r.upload}</Td>
                <Td>{r.archived}</Td>
              </Tr>
            ))}
            {studyRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      ) : (
        <DataTable className="mt-2">
          <thead>
            <tr>
              <Th sortable={false}>研究中心</Th>
              <Th sortable={false}>临床监查员</Th>
              <Th sortable={false}>上传</Th>
              <Th sortable={false}>待审批</Th>
              <Th sortable={false}>驳回</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {siteRows.map((r) => {
              /* R32：CRA 列改读研究中心注册表；未配置显示 — */
              const cra = craNameOf(state.centers, r.center)
              return (
              <Tr key={r.center}>
                <Td>{r.center}</Td>
                <Td>
                  {cra ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-medium text-teal-600">
                        {cra.slice(0, 1)}
                      </span>
                      {cra}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
                <Td>{r.uploaded}</Td>
                <Td>{r.pending}</Td>
                <Td>{r.rejected}</Td>
                <Td>{r.archived}</Td>
              </Tr>
              )
            })}
            {siteRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      )}
    </PageCard>
  )
}

/* ---------- 研究中心管理（PM 首页专属模块，R32 由「研究中心 CRA 分配」升级） ---------- */

/** R32：研究中心注册表为全系统唯一中心数据源——SITE 目录创建勾选、双端递交矩阵中心列、
    CRA 上传弹窗中心下拉、各页「临床监查员」列均实时读取本表 */
function CenterManageCard() {
  const { state, dispatch } = useStore()
  /* editId：'new' = 新增；否则为编辑中的中心 id；null = 弹窗关闭 */
  const [editId, setEditId] = useState<string | 'new' | null>(null)
  const [fProject, setFProject] = useState('')
  const [fName, setFName] = useState('')
  const [fCra, setFCra] = useState('')

  const rows = useMemo(
    () =>
      [...state.centers].sort(
        (a, b) => a.projectNo.localeCompare(b.projectNo) || a.name.localeCompare(b.name, 'zh'),
      ),
    [state.centers],
  )
  /* CRA 候选：后台执行人员账号（冻结账号历史仍可作为已分配值展示，但不再出现在候选中） */
  const craOptions = useMemo(
    () =>
      [...new Set(state.accounts.filter((a) => a.role === 'executor' && a.status !== '关闭').map((a) => a.name))].map(
        (n) => ({ label: n, value: n }),
      ),
    [state.accounts],
  )
  /* 项目编号输入辅助：注册表 ∪ 目录已有编号 */
  const projectCandidates = useMemo(
    () =>
      [...new Set([...state.centers.map((c) => c.projectNo), ...state.catalogs.map((c) => c.projectNo)])]
        .filter(Boolean)
        .sort(),
    [state.centers, state.catalogs],
  )

  /* 已建目录判定：该「项目 + 中心」已存在 SITE TMF 目录（删除需确认；项目编号锁定不可改） */
  const builtOf = (c: Center) =>
    state.catalogs.some((cat) => cat.kind === 'site' && cat.center === c.name && projPrefixMatch(cat.projectNo, c.projectNo))
  const editing = editId && editId !== 'new' ? (state.centers.find((c) => c.id === editId) ?? null) : null
  const editingBuilt = editing ? builtOf(editing) : false

  const openNew = () => {
    setEditId('new')
    setFProject(state.activeProject !== '全部' ? state.activeProject : '')
    setFName('')
    setFCra('')
  }
  const openEdit = (c: Center) => {
    setEditId(c.id)
    setFProject(c.projectNo)
    setFName(c.name)
    setFCra(c.cra)
  }

  const confirm = () => {
    const projectNo = fProject.trim()
    const name = fName.trim()
    if (!projectNo) {
      toast.warning('请输入项目编号')
      return
    }
    if (!name) {
      toast.warning('请输入研究中心名称')
      return
    }
    const dup = state.centers.some(
      (c) => c.id !== editId && c.projectNo === projectNo && c.name === name,
    )
    if (dup) {
      toast.warning('该中心已存在', { description: `${projectNo} 下已配置「${name}」，请勿重复添加` })
      return
    }
    if (editId === 'new') {
      dispatch({ type: 'addCenter', center: { id: nextId('ct'), name, projectNo, cra: fCra } })
      toast.success('已新增研究中心', { description: `${projectNo} / ${name}${fCra ? ` · CRA：${fCra}` : ''}` })
    } else if (editing) {
      const renamed = name !== editing.name
      dispatch({ type: 'updateCenter', id: editing.id, patch: { projectNo, name, cra: fCra } })
      toast.success('研究中心已更新', {
        description: renamed ? `「${editing.name}」已更名为「${name}」，已建目录/文件/递交矩阵同步更新` : `${projectNo} / ${name}`,
      })
    }
    setEditId(null)
  }

  const remove = (c: Center) => {
    /* 已建目录中心删除前确认：仅移除注册表配置，目录与文件保留 */
    if (
      builtOf(c) &&
      !window.confirm(
        `研究中心「${c.name}」（${c.projectNo}）已创建 SITE TMF 目录。\n\n删除仅移除注册表配置，已建目录与其中的文件会保留；但目录创建勾选、递交矩阵中心列、上传弹窗中心下拉等处将不再显示该中心。\n\n确认删除？`,
      )
    ) {
      return
    }
    dispatch({ type: 'removeCenter', id: c.id })
    toast.success('已删除研究中心', { description: `${c.projectNo} / ${c.name}` })
  }

  return (
    <PageCard
      title="研究中心管理"
      extra={
        <div className="flex items-center gap-3">
          <span className="text-xs font-normal text-gray-400">
            注册表供目录创建 / 递交矩阵 / 上传弹窗等全系统使用，「临床监查员」列同步更新
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-teal-200 text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700"
            onClick={openNew}
          >
            <Plus className="h-3.5 w-3.5" /> 新增中心
          </Button>
        </div>
      }
    >
      <DataTable>
        <thead>
          <tr>
            <Th sortable={false} className="w-48">项目编号</Th>
            <Th sortable={false} className="w-[30%]">研究中心</Th>
            <Th sortable={false} className="w-48">临床监查员</Th>
            <Th sortable={false} className="w-32">操作</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const built = builtOf(c)
            return (
              <Tr key={c.id}>
                <Td>{c.projectNo}</Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    {c.name}
                    {built && (
                      <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-400">已建目录</span>
                    )}
                  </span>
                </Td>
                <Td>
                  {c.cra ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-medium text-teal-600">
                        {c.cra.slice(0, 1)}
                      </span>
                      {c.cra}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-3">
                    <TealLink onClick={() => openEdit(c)}>
                      <span className="inline-flex items-center gap-1">
                        <Pencil className="h-3 w-3" /> 编辑
                      </span>
                    </TealLink>
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" /> 删除
                    </button>
                  </span>
                </Td>
              </Tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-10 text-center text-sm text-gray-400">
                暂无研究中心，点击右上角「新增中心」添加
              </td>
            </tr>
          )}
        </tbody>
      </DataTable>

      {/* 新增 / 编辑弹窗 */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Hospital className="h-4 w-4 text-teal-600" /> {editId === 'new' ? '新增研究中心' : '编辑研究中心'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">项目编号</label>
              <input
                autoFocus={editId === 'new'}
                value={fProject}
                onChange={(e) => setFProject(e.target.value)}
                list="center-project-candidates"
                placeholder="请输入项目编号"
                disabled={editingBuilt}
                className={cn(
                  'h-9 w-full rounded-md border border-teal-300 px-3 text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100',
                  editingBuilt && 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400',
                )}
              />
              <datalist id="center-project-candidates">
                {projectCandidates.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              {editingBuilt && <p className="text-xs text-gray-400">已建目录中心的项目编号不可修改</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">研究中心名称</label>
              <input
                autoFocus={editId !== 'new'}
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
                placeholder="请输入研究中心名称"
                className="h-9 w-full rounded-md border border-teal-300 px-3 text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              {editingBuilt && (
                <p className="text-xs text-amber-500">改名将同步更新已建 SITE 目录名称、文件归属与递交矩阵</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">临床监查员（CRA）</label>
              <ToolbarSelect
                value={fCra}
                onChange={setFCra}
                options={[{ label: '暂不分配', value: '' }, ...craOptions]}
                className="w-full [&>select]:w-full"
              />
              <p className="text-xs text-gray-400">CRA 候选取自后台「账户配置」中的执行人员账号</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditId(null)}>
                取消
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={confirm}>
                {editId === 'new' ? '确认新增' : '确认保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageCard>
  )
}

/* ---------- 项目 PM 分配（PM 首页专属模块） ---------- */

/** PM 候选名单：演示数据，可与已分配姓名合并去重 */
const PM_CANDIDATES = ['石磊', '王金', '李华', '陈明', '赵敏']

function PmAssignCard() {
  const { state, dispatch } = useStore()
  const [assignProject, setAssignProject] = useState<string | null>(null)
  const [pmName, setPmName] = useState('')

  /* 项目全集：STUDY TMF 目录项目编号 ∪ 已配置过的项目 */
  const projects = useMemo(() => {
    const set = new Set<string>(Object.keys(state.pmMap))
    for (const c of state.catalogs) if (c.kind === 'study') set.add(c.projectNo)
    return [...set].sort()
  }, [state.catalogs, state.pmMap])

  /* 弹窗候选：内置名单 ∪ 已分配过的 PM 姓名 */
  const candidates = useMemo(
    () => [...new Set([...PM_CANDIDATES, ...Object.values(state.pmMap)])],
    [state.pmMap],
  )

  const openAssign = (project: string) => {
    setAssignProject(project)
    setPmName(pmOfProject(state.pmMap, project))
  }

  const confirmAssign = () => {
    const name = pmName.trim()
    if (!assignProject) return
    if (!name) {
      toast.warning('请输入项目经理姓名')
      return
    }
    dispatch({ type: 'assignPm', projectNo: assignProject, pm: name })
    toast.success('分配成功', { description: `${assignProject} 的项目经理已更新为 ${name}` })
    setAssignProject(null)
  }

  return (
    <PageCard
      title="项目 PM 分配"
      extra={<span className="text-xs font-normal text-gray-400">按「项目编号」分配，各页面的「项目经理」列同步更新</span>}
    >
      <DataTable>
        <thead>
          <tr>
            <Th sortable={false} className="w-[34%]">项目编号</Th>
            <Th sortable={false} className="w-56">项目经理</Th>
            <Th sortable={false} className="w-28">操作</Th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <Tr key={p}>
              <Td>{p}</Td>
              <Td>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-medium text-teal-600">
                    {pmOfProject(state.pmMap, p).slice(0, 1)}
                  </span>
                  {pmOfProject(state.pmMap, p)}
                </span>
              </Td>
              <Td>
                <TealLink onClick={() => openAssign(p)}>
                  {p in state.pmMap ? '更换' : '分配'}
                </TealLink>
              </Td>
            </Tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={3} className="py-10 text-center text-sm text-gray-400">
                暂无可分配的项目（请先在 STUDY TMF 创建目录）
              </td>
            </tr>
          )}
        </tbody>
      </DataTable>

      {/* 分配弹窗 */}
      <Dialog open={!!assignProject} onOpenChange={(o) => !o && setAssignProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <UserRoundPlus className="h-4 w-4 text-teal-600" /> 分配项目经理
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              <p className="text-xs text-gray-400">项目编号</p>
              <p className="mt-0.5 text-sm font-medium text-gray-800">{assignProject}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">项目经理（PM）姓名</label>
              <input
                autoFocus
                value={pmName}
                onChange={(e) => setPmName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmAssign()}
                list="pm-candidates"
                placeholder="输入或选择 PM 姓名"
                className="h-9 w-full rounded-md border border-teal-300 px-3 text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <datalist id="pm-candidates">
                {candidates.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <p className="text-xs text-gray-400">可从候选名单中选择，或直接输入新姓名</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setAssignProject(null)}>
                取消
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={confirmAssign}>
                确认分配
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageCard>
  )
}

export default function Home() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-5">
        <StudyDonutCard />
        <SiteStatCards />
      </div>
      <SummaryBarCard />
      <BottomTabsCard />
      <CenterManageCard />
      <PmAssignCard />
    </div>
  )
}
