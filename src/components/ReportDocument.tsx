/* A4 风格"开题报告"文档（HTML 模拟 PDF 内容），共 4 页 */
import type { ReactElement, ReactNode } from 'react'

function P({ children, indent = true }: { children: ReactNode; indent?: boolean }) {
  return (
    <p className={`mb-3 text-justify text-[13px] leading-[1.9] text-gray-900 ${indent ? 'indent-[2em]' : ''}`}>
      {children}
    </p>
  )
}

function H2({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 mb-3 text-center font-serif text-[15px] font-bold text-black">{children}</h3>
}

function H3({ children }: { children: ReactNode }) {
  return <h4 className="mt-4 mb-2 text-[13px] font-bold text-black">{children}</h4>
}

function InfoTable() {
  const cell = 'border border-gray-800 px-3 py-2 text-[13px] text-gray-900'
  const label = `${cell} bg-white text-center font-bold whitespace-nowrap`
  return (
    <table className="mb-6 w-full border-collapse">
      <tbody>
        <tr>
          <td className={label} style={{ width: '14%' }}>学　　院</td>
          <td className={`${cell} text-center`} style={{ width: '28%' }}>XXXX</td>
          <td className={label} style={{ width: '14%' }}>专　　业</td>
          <td className={`${cell} text-center`} colSpan={3}>XXXX</td>
        </tr>
        <tr>
          <td className={label}>姓　　名</td>
          <td className={`${cell} text-center`}>XXX</td>
          <td className={label}>年级|班级</td>
          <td className={`${cell} text-center`}>20XX 级 X 班</td>
          <td className={label} style={{ width: '12%' }}>学　　号</td>
          <td className={`${cell} text-center`}>XXXXXX</td>
        </tr>
        <tr>
          <td className={label}>论文题目</td>
          <td className={`${cell} text-center font-bold`} colSpan={5}>
            现代航海中雷达导航技术的正确应用研究
          </td>
        </tr>
        <tr>
          <td className={label}>指导教师</td>
          <td className={`${cell} text-center`} colSpan={5}>XXXX</td>
        </tr>
      </tbody>
    </table>
  )
}

function PageOne() {
  return (
    <>
      <h2 className="mt-2 mb-8 text-center font-serif text-[26px] font-bold tracking-[0.3em] text-black">
        开题报告
      </h2>
      <InfoTable />
      <H2>一、选题缘起与意义</H2>
      <H3>（一）选题缘起</H3>
      <P>
        导航是指船舶在海上航行时，对船舶进行指引。在古代，天文星体与地磁是人们重要的导航手段。但是在科技发达的今天，更多新的导航设备与技术涌现。旧的方法不断被新技术所取代，使得船舶导航不断的发展进步。而雷达是现代船舶导航重要的一个设备。
      </P>
      <P>
        船舶雷达在海上运用非常广泛，是船舶非常重要的助航工具，对于船舶而言，它就是一双"眼睛"。在早期没有雷达的时候，船舶是单纯按照海图来航行的，但是受到风浪的影响，船舶的航向会有所偏差。为了避免航行偏移航线，船员需要不断的进行观测定位，从而矫正航向。而如今雷达可以结合各种设备进行导航，降低碰撞的风险，提高航信安全。
      </P>
      <H3>（二）选题意义</H3>
      <P>
        随着导航雷达技术的逐渐成熟，不断研发出新的硬件设施、算法软件、导航功能和新型产品，导航雷达也由原来的导航导航功能朝着实现多元化、便捷化发展。导航雷达技术在船舶导航中的运用也越来越广泛，但就单一的雷达导航技术而言，遇到复杂的地形和天气时雷达导航的不足之处就显现出来，为了解决这些问题就需要与其他相关技术相结合来完成。因此本文通过研究雷达与 AIS
        结合、雷达与电子海图结合、雷达与 GPS 结合进行船舶导航的优劣势，旨在探索我国现代船舶雷达导航的优化方法。为我国的航海事业尽一份绵薄之力。
      </P>
      <H2>二、研究现状与问题</H2>
      <P>
        目前，雷达模拟器主要分为只产生雷达信号的雷达信号模拟器和完整的虚拟雷达模拟，前者主要用于雷达的测试，后者主要用于雷达操作的演示和训练。
      </P>
    </>
  )
}

function PageTwo() {
  return (
    <>
      <H2>二、研究现状与问题（续）</H2>
      <P>
        国外对船舶导航雷达的研究起步较早，已形成较为成熟的产品体系与训练规范。多部国际公约与标准对船载雷达的性能指标、显示方式与操作要求作出了明确规定，推动了雷达导航技术在远洋船舶上的普及与应用。与此同时，国外学者在雷达目标跟踪、杂波抑制与多传感器融合等方向上持续深耕，取得了大量可借鉴的成果。
      </P>
      <P>
        国内方面，随着智能航运与电子航海战略的推进，雷达与 AIS、电子海图、GPS
        等设备的综合应用研究日益增多。众多高校与科研院所围绕雷达图像处理、航迹融合算法与避碰决策支持等课题展开研究，部分成果已在国产船载设备中得到应用。但总体而言，在复杂海况下的稳定跟踪、多源信息的一致性与可靠性验证等方面仍存在提升空间。
      </P>
      <P>
        综合已有研究可以发现：单一导航手段在特定场景下均存在局限，雷达导航也不例外。在强降雨、大浪等恶劣天气条件下，雷达回波易受干扰，弱小目标存在漏警风险；而在狭水道与密集交通水域，单纯依赖雷达进行避碰判断也会给驾驶员带来较大的工作负荷。因此，如何将雷达与其他助航设备有机结合，发挥各自优势，是当前船舶导航领域值得深入研究的问题。
      </P>
      <P>
        本文正是基于上述背景展开，围绕雷达导航技术的正确应用这一核心问题，系统梳理相关理论与方法，并结合典型场景分析其应用要点，以期为船舶安全航行提供有益的参考。
      </P>
    </>
  )
}

function PageThree() {
  return (
    <>
      <H2>三、研究内容与方法</H2>
      <H3>（一）研究内容</H3>
      <P>
        本文的研究内容主要包括以下几个方面：第一，梳理船舶导航雷达的基本组成、工作原理与主要性能指标，明确其在现代航海中的地位与作用；第二，分析雷达在目标探测、跟踪与避碰中的应用流程，归纳影响其应用效果的关键因素；第三，研究雷达与 AIS、电子海图、GPS
        等设备融合应用的典型模式，比较各模式在不同航行场景下的优劣势；第四，结合典型航行案例，提出雷达导航技术正确应用的操作要点与注意事项。
      </P>
      <H3>（二）研究方法</H3>
      <P>
        本文拟采用文献研究法、比较分析法与案例研究法相结合的研究方法。通过查阅国内外相关文献与规范标准，掌握雷达导航技术的发展脉络与研究现状；通过比较不同融合应用模式的性能表现，归纳各自的适用条件；通过剖析典型航行案例，验证所提出应用要点的合理性与可操作性。
      </P>
      <P>
        在研究过程中，将充分利用学校图书馆、电子数据库以及船舶模拟器等资源，确保研究资料翔实、论证过程严谨、研究结论可靠。
      </P>
    </>
  )
}

function PageFour() {
  return (
    <>
      <H2>四、预期成果与进度安排</H2>
      <P>
        本文预期形成一篇结构完整、论证充分的学士学位论文，系统阐述现代航海中雷达导航技术的正确应用方法，为船舶驾驶员合理使用雷达及融合助航设备提供参考，同时为后续相关研究奠定基础。
      </P>
      <P indent={false}>进度安排如下：</P>
      <P indent={false}>第一阶段（第 1—2 周）：收集整理文献资料，完成开题报告；</P>
      <P indent={false}>第二阶段（第 3—6 周）：开展理论分析与比较研究，形成论文初稿；</P>
      <P indent={false}>第三阶段（第 7—9 周）：结合案例完善论证，修改形成论文二稿；</P>
      <P indent={false}>第四阶段（第 10—12 周）：定稿、排版并准备答辩。</P>
      <H2>五、参考文献（节选）</H2>
      <P indent={false}>[1] 国际海事组织. 国际海上避碰规则公约[M]. 北京: 人民交通出版社, 20XX.</P>
      <P indent={false}>[2] 王某某. 船舶导航雷达原理与应用[M]. 大连: 大连海事大学出版社, 20XX.</P>
      <P indent={false}>[3] 李某某. 现代航海技术中多传感器融合研究[J]. 航海技术, 20XX(3): 12-18.</P>
    </>
  )
}

const pages: Record<number, () => ReactElement> = {
  1: PageOne,
  2: PageTwo,
  3: PageThree,
  4: PageFour,
}

export default function ReportDocument({ page }: { page: number }) {
  const Content = pages[page] ?? PageOne
  return (
    <div
      className="mx-auto w-[794px] shrink-0 bg-white px-[72px] py-[64px] text-black shadow-[0_2px_16px_rgba(15,23,42,0.12)]"
      style={{ minHeight: 1123 }}
    >
      <Content />
      <div className="mt-10 text-center text-xs text-gray-400">— {page} —</div>
    </div>
  )
}
