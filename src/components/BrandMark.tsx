/* R41 品牌字标 BrandMark：纯 SVG 实现参照「科研数据管理平台」登录页的 CLINI X TRIALS 字标设计——
   描边空心渐变字（teal→紫、内部极浅填充的线框感）、左上/右下对角细角框、底部微笑弧线贯穿。
   登录页 header/登录卡与应用内顶栏共用；同页多实例共享同一渐变 id（颜色一致，无冲突）。
   不再叠加 assets 里的 logo png（与描边字标冲突）。 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 64" className={className} role="img" aria-label="CLINI X TRIALS">
      <defs>
        <linearGradient id="brandMarkGrad" x1="0" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {/* 左上细角框（⌐ 式：顶横 + 左竖） */}
      <path d="M 34 11 L 12 11 L 12 29" stroke="url(#brandMarkGrad)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* 右下细角框（底横 + 右竖） */}
      <path d="M 248 35 L 248 53 L 226 53" stroke="url(#brandMarkGrad)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* 字标：描边空心渐变斜体粗字 */}
      <text
        x="130"
        y="40"
        textAnchor="middle"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontStyle="italic"
        fontWeight="900"
        fontSize="22"
        letterSpacing="1.5"
        fill="rgba(45,212,191,0.05)"
        stroke="url(#brandMarkGrad)"
        strokeWidth="1.25"
      >
        CLINI X TRIALS
      </text>
      {/* 微笑弧线：字标底部贯穿 */}
      <path d="M 20 52 Q 130 66 240 52" stroke="url(#brandMarkGrad)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}
