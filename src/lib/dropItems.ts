/** 页面级拖拽读取：优先走 DataTransferItem.webkitGetAsEntry 递归遍历（支持文件夹），
    回退 dataTransfer.files（纯文件）。返回扁平化文件列表与共同根目录名（单文件夹拖入时）。
    relName：文件夹拖入时为相对根目录的路径（与上传文件夹 input 的 webkitRelativePath 去根段一致） */
export interface DroppedPayload {
  items: { file: File; relName: string }[]
  dirRoot: string | null
}

interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (cb: (f: File) => void) => void
  createReader?: () => { readEntries: (cb: (ents: FsEntry[]) => void) => void }
}

export async function readDroppedItems(dt: DataTransfer | null): Promise<DroppedPayload> {
  if (!dt) return { items: [], dirRoot: null }
  const itemList = Array.from(dt.items ?? [])
  const entries = itemList
    .map((it) => (typeof it.webkitGetAsEntry === 'function' ? (it.webkitGetAsEntry() as FsEntry | null) : null))
    .filter((e): e is FsEntry => !!e)

  if (entries.length === 0) {
    const files = Array.from(dt.files ?? [])
    return { items: files.map((f) => ({ file: f, relName: f.name })), dirRoot: null }
  }

  const out: { file: File; relName: string }[] = []
  /* 单个根且为文件夹 → 视为文件夹拖入，子项相对路径不含根名 */
  const dirRoot = entries.length === 1 && entries[0].isDirectory ? entries[0].name : null

  const readAllEntries = async (reader: { readEntries: (cb: (ents: FsEntry[]) => void) => void }): Promise<FsEntry[]> => {
    /* Chrome 每次 readEntries 最多返回 100 条，需循环读到空 */
    const all: FsEntry[] = []
    for (;;) {
      const batch = await new Promise<FsEntry[]>((res) => reader.readEntries(res))
      if (batch.length === 0) break
      all.push(...batch)
    }
    return all
  }
  const walk = async (entry: FsEntry, prefix: string, includeSelf: boolean): Promise<void> => {
    if (entry.isFile && entry.file) {
      const f = await new Promise<File>((res) => entry.file!(res))
      out.push({ file: f, relName: prefix + f.name })
      return
    }
    if (entry.isDirectory && entry.createReader) {
      const childPrefix = includeSelf ? `${prefix}${entry.name}/` : prefix
      const ents = await readAllEntries(entry.createReader())
      for (const en of ents) await walk(en, childPrefix, true)
    }
  }
  for (const en of entries) {
    await walk(en, '', !(dirRoot && en.name === dirRoot))
  }
  return { items: out, dirRoot }
}
