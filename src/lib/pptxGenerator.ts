// lib/pptxGenerator.ts — PPTX generation using JSZip

import type { AIProvider } from './providers/types'

export interface SlideContent {
  title: string
  bullets: string[]
  notes?: string
  layout: 'title' | 'content' | 'twoColumn' | 'closing'
}

export interface PptxPlanConfig {
  topic: string
  slideCount: number // 5-15
  style: 'business' | 'academic' | 'casual'
  locale: string
}

function parseJsonArray(text: string): string[] {
  const jsonMatch = text.match(/\[[\s\S]*?\]/)
  if (!jsonMatch) {
    throw new Error('Failed to parse outline from AI response')
  }
  const parsed: unknown = JSON.parse(jsonMatch[0])
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Empty outline received')
  }
  return parsed.map(String)
}

export async function generateOutline(
  provider: AIProvider,
  model: string,
  config: PptxPlanConfig,
): Promise<string[]> {
  const stylePrompts = {
    business: '비즈니스 프레젠테이션',
    academic: '학술 발표',
    casual: '일반 발표',
  }

  const prompt = `다음 주제로 "${stylePrompts[config.style] || '프레젠테이션'}" 슬라이드 제목 목록을 생성해주세요.
JSON 배열 형태로 반환해주세요 (예: ["제목1", "제목2", "제목3"]).
${config.slideCount}개의 슬라이드 제목을 만들어주세요.

주제: ${config.topic}`

  let fullText = ''
  const gen = provider.stream({
    model,
    messages: [{ role: 'user', content: prompt }],
  })
  for await (const chunk of gen) {
    fullText += chunk
  }
  return parseJsonArray(fullText)
}

export async function generateSlideContent(
  provider: AIProvider,
  model: string,
  slideTitle: string,
  config: PptxPlanConfig,
  slideIndex: number,
  totalSlides: number,
): Promise<SlideContent> {
  let layoutType: SlideContent['layout'] = 'content'
  if (slideIndex === 0) layoutType = 'title'
  else if (slideIndex === totalSlides - 1) layoutType = 'closing'

  const prompt = `"${config.topic}" 프레젠테이션의 다음 슬라이드 내용을 작성해주세요.

슬라이드 제목: ${slideTitle}
슬라이드 번호: ${slideIndex + 1} / ${totalSlides}

다음 JSON 형식으로 반환해주세요:
{
  "bullets": ["요점1", "요점2", "요점3"],
  "notes": "발표자 노트 (선택)"
}

bullets는 3-5개의 핵심 내용을 간결하게 작성해주세요.`

  let fullText = ''
  const gen = provider.stream({
    model,
    messages: [{ role: 'user', content: prompt }],
  })
  for await (const chunk of gen) {
    fullText += chunk
  }

  const jsonMatch = fullText.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse slide content from AI response')
  }
  const parsed = JSON.parse(jsonMatch[0]) as { bullets: string[]; notes?: string }

  return {
    title: slideTitle,
    bullets: parsed.bullets || [],
    notes: parsed.notes,
    layout: layoutType,
  }
}

export async function generatePptx(slides: SlideContent[]): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  // [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${slides.map((_, i) => `  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n')}
</Types>`,
  )

  // _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  )

  // ppt/presentation.xml
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
${slides.map((_, i) => `    <p:sldId id="${2147483649 + i}" r:id="rId${i + 2}"/>`).join('\n')}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`,
  )

  // ppt/_rels/presentation.xml.rels
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${slides.map((_, i) => `  <Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('\n')}
</Relationships>`,
  )

  // ppt/slideMasters/slideMaster1.xml
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`,
  )

  // ppt/slideLayouts/slideLayout1.xml
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`,
  )

  // ppt/theme/theme1.xml
  zip.file(
    'ppt/theme/theme1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F497D"/></a:dk2>
      <a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
      <a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
      <a:accent2><a:srgbClr val="C0504D"/></a:accent2>
      <a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
      <a:accent4><a:srgbClr val="8064A2"/></a:accent4>
      <a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
      <a:accent6><a:srgbClr val="F79646"/></a:accent6>
      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="800080"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office"><a:majorFont/><a:minorFont/></a:fontScheme>
    <a:fmtScheme name="Office"/>
  </a:themeElements>
</a:theme>`,
  )

  // Generate slide XMLs
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const bulletXml = slide.bullets
      .map(
        (bullet) =>
          `<a:p><a:pPr lvl="0"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="ko-KR" sz="1800"/><a:t>${bullet}</a:t></a:r></a:p>`,
      )
      .join('')

    let contentXml = ''
    if (slide.layout === 'title') {
      contentXml = `<p:sp>
  <p:nvSpPr><p:cNvPr id="1" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
  <p:spPr/>
  <p:txBody>
    <a:bodyPr/>
    <a:lstStyle/>
    <a:p><a:r><a:rPr lang="ko-KR" sz="4400" b="1"/><a:t>${slide.title}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`
    } else {
      contentXml = `<p:sp>
  <p:nvSpPr><p:cNvPr id="1" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
  <p:spPr/>
  <p:txBody>
    <a:bodyPr/>
    <a:lstStyle/>
    <a:p><a:r><a:rPr lang="ko-KR" sz="2800" b="1"/><a:t>${slide.title}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>
<p:sp>
  <p:nvSpPr><p:cNvPr id="2" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1" type="body"/></p:nvPr></p:nvSpPr>
  <p:spPr/>
  <p:txBody>
    <a:bodyPr/>
    <a:lstStyle/>
    ${bulletXml}
  </p:txBody>
</p:sp>`
    }

    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${contentXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`,
    )

    zip.file(
      `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`,
    )
  }

  const blob: Blob = await zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })

  return blob
}
