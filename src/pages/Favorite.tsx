import { Star, FolderHeart } from 'lucide-react'
import { toast } from 'sonner'
import { PageCard, DataTable, Th, Td, NameTd, Tr, FileTypeIcon, TealLink } from '@/components/common'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { useStore } from '@/store'

/* 我的收藏：仅具体文件可收藏（文件夹无收藏入口）；列表从 store 实时派生 */
export default function Favorite() {
  const { state, dispatch } = useStore()
  const files = state.files.filter((f) => f.id in state.favorites)

  const unfavorite = (id: string) => {
    dispatch({ type: 'toggleFavorite', id })
    toast.success('已取消收藏')
  }

  return (
    <PageCard title="我的收藏">
      {files.length > 0 ? (
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false}>文件名称</Th>
              <Th>项目编号</Th>
              <Th>收藏日期</Th>
              <Th>文件大小</Th>
              <Th sortable={false}>操作</Th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <Tr key={f.id}>
                <NameTd>
                  <span className="flex items-center gap-2.5">
                    <Star className="h-4 w-4 fill-teal-500 text-teal-500" />
                    <FileTypeIcon kind={f.kind} />
                    <span className="text-gray-700">{f.name}</span>
                  </span>
                </NameTd>
                <Td>{f.projectNo}</Td>
                <Td>{state.favorites[f.id]}</Td>
                <Td>{f.size}</Td>
                <Td>
                  <TealLink onClick={() => unfavorite(f.id)}>取消收藏</TealLink>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderHeart className="h-6 w-6 text-gray-400" />
            </EmptyMedia>
            <EmptyTitle className="text-base text-gray-600">暂无收藏文件</EmptyTitle>
            <EmptyDescription>点击文件名称旁的星标即可收藏，收藏的文件会显示在这里</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </PageCard>
  )
}
