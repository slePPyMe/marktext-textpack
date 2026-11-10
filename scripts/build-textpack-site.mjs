import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'docs/textpack-site')
const output = path.join(root, 'dist/textpack-site')
const baseUrl = 'https://sleppyme.github.io/marktext-textpack/'
const repository = 'https://github.com/slePPyMe/marktext-textpack'
const releases = `${repository}/releases/latest`

const languages = {
  zh: {
    lang: 'zh-CN',
    title: 'MarkText TextPack — 把 Markdown 和图片保存在一个可编辑文件中',
    description:
      '免费开源的 Markdown 编辑器，原生打开、编辑和保存 .textpack，把 Markdown 与本地图片放进一个可继续编辑的文件。提供 Windows、macOS、Linux 的 x64 和 ARM64 下载。',
    skip: '跳到正文',
    navigation: '主要导航',
    usage: '怎么使用',
    download: '下载 TextPack 版',
    source: '查看源码',
    badge: '开源 · 非官方 MarkText 分支',
    heading: 'Markdown 和图片，<br>一个文件带走。',
    intro:
      '把正文和本地图片存进一个 <code>.textpack</code> 文件。移动、分享、同步之后，打开它，继续在 MarkText 里编辑。',
    platforms: 'Windows · macOS · Linux / x64 · ARM64',
    fileCaption: '一个文件，包含整篇图文笔记',
    fileText: 'Markdown 正文',
    fileImages: '本地图片与资源',
    fileMetadata: '开放格式的元数据',
    screenshotLabel: '实际编辑界面',
    screenshotTitle: '熟悉的 MarkText，多一个便携的文件格式。',
    screenshotAlt:
      'MarkText TextPack 0.23.0 实际界面，正在编辑包含本地图片的 field-notes.textpack 笔记',
    screenshotCaption: 'Windows x64 v0.23.0 的实际编辑界面。图文内容为示例笔记。',
    workflowTitle: '写下来，存到一起，再打开。',
    steps: [
      [
        '打开一篇 Markdown',
        '新建笔记，或打开现有 <code>.md</code> 文件。在所见即所得编辑器和源码模式之间自由切换。'
      ],
      [
        '另存为 .textpack',
        '选择「文件 → 另存为」，使用 <code>.textpack</code> 扩展名。本地图片会与正文一起打包。'
      ],
      [
        '带走文件，继续编辑',
        '移动或分享这个文件；再次打开后，继续编辑并保存。也可以导出为 Markdown 和资源文件夹。'
      ]
    ],
    sample: '下载示例 TextPack',
    sampleDescription: '先用一篇带本地插图的笔记试试看。',
    downloadsTitle: '选择适合你的安装包。',
    downloadsIntro:
      '下载名称以 <code>marktext-textpack-</code> 开头。版本跟随上游正式版，构建与检查完成后发布。',
    tableHeaders: ['平台', '架构', '安装包类型'],
    allDownloads: '前往最新 Release 下载',
    checksum: 'Release 提供 SHA256SUMS.txt 校验和与自动更新文件。',
    unsigned:
      '安装包未签名。此分支沿用 MarkText 的应用标识与设置目录，安装前请留意已有 MarkText；macOS 的首次打开方法见 Release 说明。',
    faqTitle: '关于 TextPack，你可能还想知道。',
    questions: [
      [
        'Windows 怎么打开和编辑 .textpack？',
        '下载本分支的 Windows 安装版或 ZIP 解压版，启动 MarkText TextPack，选择「文件 → 打开」，或把 <code>.textpack</code> 拖进编辑器。它可以直接编辑并保存，无需先手动解压。'
      ],
      [
        '怎样把 Markdown 和图片保存成一个文件？',
        '打开已有 Markdown，选择「文件 → 另存为」，将扩展名设为 <code>.textpack</code>。相对路径、本地绝对路径、文件 URL 和受支持的 Base64 图片会被收集。尚未保存的文档含相对图片时，请先把 Markdown 存在图片附近。'
      ],
      [
        '在线图片也会自动下载吗？',
        'HTTP/HTTPS 在线图片目前保留远程引用，不会自动下载。若要离线携带，请先将所需图片保存到本地，再转换为 TextPack。'
      ],
      [
        '支持 TextBundle 吗？',
        '支持压缩的 <code>.textpack</code> 文件：读取 Markdown 类型的 v1/v2，保存为 v2，并保留兼容的元数据和包内资源。目前要求 ZIP 根目录直接包含 <code>info.json</code> 和 <code>text.*</code>；暂不支持目录形式的 <code>.textbundle</code>，也不接受另套一层 TextBundle 文件夹的压缩包。'
      ],
      [
        '文件会被锁在这个编辑器里吗？',
        'TextPack 是开放的 ZIP 容器，包含 Markdown 正文、<code>assets/</code> 和 <code>info.json</code>，可以查看其中内容，也可以导出成普通 Markdown。各应用对格式扩展的支持可能不同。'
      ],
      [
        '这是 MarkText 官方版本吗？',
        '这是独立维护的非官方分支，基于 MIT 许可的 MarkText 增加 TextPack 支持。开发分支跟随上游 develop；供下载的稳定版基于相应上游正式标签。'
      ]
    ],
    documentation: '完整使用说明',
    standard: 'TextBundle 格式规范',
    footer: '基于开源 MarkText，独立维护。免费使用，MIT 许可。'
  },
  en: {
    lang: 'en',
    title: 'MarkText TextPack — Markdown and images in one editable file',
    description:
      'A free, open-source Markdown editor with native .textpack support. Keep Markdown and local images in one portable, editable file. Download for Windows, macOS and Linux on x64 and ARM64.',
    skip: 'Skip to content',
    navigation: 'Main navigation',
    usage: 'How it works',
    download: 'Download TextPack edition',
    source: 'View source',
    badge: 'Open source · Unofficial MarkText fork',
    heading: 'Markdown & images.<br>One editable file.',
    intro:
      'Keep your text and local images together in a <code>.textpack</code> file. Move it, share it, sync it. Then open it in MarkText and keep writing.',
    platforms: 'Windows · macOS · Linux / x64 · ARM64',
    fileCaption: 'One file. The whole illustrated note.',
    fileText: 'Your Markdown text',
    fileImages: 'Local images and resources',
    fileMetadata: 'Open-format metadata',
    screenshotLabel: 'Inside the editor',
    screenshotTitle: 'The MarkText you know, with a portable document format.',
    screenshotAlt:
      'The actual MarkText TextPack 0.23.0 editor on Windows, editing field-notes.textpack with a bundled local image',
    screenshotCaption:
      'Actual Windows x64 v0.23.0 interface. The illustrated note is demonstration content.',
    workflowTitle: 'Write it. Keep it together. Open it again.',
    steps: [
      [
        'Open your Markdown',
        'Start a note or open an existing <code>.md</code> file. Use the visual editor or switch to source mode.'
      ],
      [
        'Save as .textpack',
        'Choose <strong>File → Save As</strong> and use the <code>.textpack</code> extension. Local images are collected with the text.'
      ],
      [
        'Take it with you',
        'Move or share the file, then reopen it to keep editing. You can also export it back to Markdown and an assets folder.'
      ]
    ],
    sample: 'Download a sample TextPack',
    sampleDescription: 'Try an editable note with its own local illustration.',
    downloadsTitle: 'A package for your desktop.',
    downloadsIntro:
      'Choose files beginning with <code>marktext-textpack-</code>. Versions follow upstream stable releases and are published after checks and builds complete.',
    tableHeaders: ['Platform', 'Architecture', 'Package types'],
    allDownloads: 'Download from the latest release',
    checksum: 'Releases include SHA256SUMS.txt checksums and update metadata.',
    unsigned:
      'Builds are unsigned and share MarkText’s application identity and settings path. Check your existing MarkText installation before installing. See the release notes for first-launch instructions on macOS.',
    faqTitle: 'A few useful details.',
    questions: [
      [
        'How do I open and edit a .textpack file on Windows?',
        'Download this fork’s Windows installer or ZIP package, launch MarkText TextPack, and choose <strong>File → Open</strong>, or drag a <code>.textpack</code> into the editor. Edit and save it directly, without manually unpacking it first.'
      ],
      [
        'How can I save Markdown and images in a single file?',
        'Open your Markdown, choose <strong>File → Save As</strong>, and use <code>.textpack</code>. Relative local images, local absolute paths, file URLs, and supported Base64 images are collected. Save an untitled Markdown file next to its resources before converting relative image paths.'
      ],
      [
        'Are online images downloaded too?',
        'HTTP/HTTPS images currently remain remote references. To take them offline, save the images locally before converting the document.'
      ],
      [
        'Does it support TextBundle?',
        'It reads Markdown v1/v2 <code>.textpack</code> files, writes v2, and preserves compatible metadata and bundled resources. The ZIP must place <code>info.json</code> and <code>text.*</code> at its root. Directory-style <code>.textbundle</code> documents and ZIPs with an enclosing TextBundle folder are currently unsupported.'
      ],
      [
        'Can I get my content back out?',
        'TextPack is an open ZIP container with Markdown text, <code>assets/</code>, and <code>info.json</code>. You can inspect its contents or export it as ordinary Markdown. Support for format extensions varies between applications.'
      ],
      [
        'Is this an official MarkText release?',
        'This is an independently maintained, unofficial fork adding TextPack support to MIT-licensed MarkText. Development follows upstream develop; downloadable stable builds use the corresponding upstream release tag.'
      ]
    ],
    documentation: 'Full usage documentation',
    standard: 'TextBundle specification',
    footer:
      'Built on open-source MarkText. Independently maintained. Free to use, under the MIT license.'
  }
}

const escape = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

for (const required of [
  'assets/editor.png',
  'assets/marktext.png',
  'assets/field-notes.textpack'
]) {
  if (!existsSync(path.join(source, required))) throw new Error(`Missing site asset: ${required}`)
}
mkdirSync(output, { recursive: true })
cpSync(path.join(source, 'assets'), path.join(output, 'assets'), { recursive: true })
cpSync(path.join(source, 'style.css'), path.join(output, 'style.css'))

for (const [key, copy] of Object.entries(languages)) {
  const prefix = key === 'en' ? '../' : './'
  const url = `${baseUrl}${key === 'en' ? 'en/' : ''}`
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MarkText TextPack',
    description: copy.description,
    url,
    downloadUrl: releases,
    applicationCategory: 'ProductivityApplication',
    operatingSystem: ['Windows', 'macOS', 'Linux'],
    isAccessibleForFree: true,
    license: `${repository}/blob/textpack/LICENSE`,
    screenshot: `${baseUrl}assets/editor.png`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
  }).replaceAll('<', '\\u003c')
  const html = `<!doctype html>
<html lang="${copy.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(copy.title)}</title>
  <meta name="description" content="${escape(copy.description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="zh-Hans" href="${baseUrl}">
  <link rel="alternate" hreflang="en" href="${baseUrl}en/">
  <link rel="alternate" hreflang="x-default" href="${baseUrl}">
  <link rel="icon" href="${prefix}assets/marktext.png">
  <link rel="stylesheet" href="${prefix}style.css">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(copy.title)}">
  <meta property="og:description" content="${escape(copy.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${baseUrl}assets/editor.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${schema}</script>
</head>
<body>
  <a class="skip" href="#main">${copy.skip}</a>
  <header class="site-header wrap">
    <a class="brand" href="${prefix}"><img src="${prefix}assets/marktext.png" width="32" height="32" alt=""><span>MarkText <strong>TextPack</strong></span></a>
    <nav aria-label="${copy.navigation}">
      <a class="nav-usage" href="#how">${copy.usage}</a>
      <a href="${repository}">GitHub ↗</a>
      <div class="language"><a href="${prefix}" lang="zh-CN"${key === 'zh' ? ' aria-current="page"' : ''}>中文</a><span aria-hidden="true">/</span><a href="${prefix}en/" lang="en"${key === 'en' ? ' aria-current="page"' : ''}>EN</a></div>
    </nav>
  </header>
  <main id="main">
    <section class="hero wrap">
      <div class="hero-copy">
        <p class="eyebrow"><span></span>${copy.badge}</p>
        <h1>${copy.heading}</h1>
        <p class="intro">${copy.intro}</p>
        <div class="actions"><a class="button primary" href="${releases}">${copy.download}<span aria-hidden="true">↗</span></a><a class="source-link" href="${repository}">${copy.source} ↗</a></div>
        <p class="platforms">${copy.platforms}</p>
      </div>
      <div class="file-visual" role="img" aria-label="${escape(copy.fileCaption)}">
        <div class="file-tab"></div>
        <div class="file-top"><span class="file-symbol" aria-hidden="true">M↓</span><span class="extension">.textpack</span></div>
        <p class="file-name">field-notes.textpack</p>
        <div class="file-tree"><p><code>text.md</code><span>${copy.fileText}</span></p><p><code>assets/</code><span>${copy.fileImages}</span></p><p><code>info.json</code><span>${copy.fileMetadata}</span></p></div>
        <p class="file-caption">${copy.fileCaption}</p>
      </div>
    </section>
    <section class="editor-section wrap" aria-labelledby="editor-title">
      <div class="section-kicker"><span class="small-dot"></span>${copy.screenshotLabel}</div>
      <h2 id="editor-title">${copy.screenshotTitle}</h2>
      <figure class="editor-figure"><img src="${prefix}assets/editor.png" width="1280" height="880" alt="${copy.screenshotAlt}" fetchpriority="high"><figcaption>${copy.screenshotCaption}</figcaption></figure>
    </section>
    <section class="workflow wrap" id="how" aria-labelledby="how-title">
      <h2 id="how-title">${copy.workflowTitle}</h2>
      <ol class="steps">${copy.steps.map(([title, text], index) => `<li><span class="step-number">0${index + 1}</span><h3>${title}</h3><p>${text}</p></li>`).join('')}</ol>
      <div class="sample"><div><a href="${prefix}assets/field-notes.textpack" download>${copy.sample} ↓</a><p>${copy.sampleDescription}</p></div><code>.textpack</code></div>
    </section>
    <section class="downloads" id="downloads" aria-labelledby="downloads-title"><div class="wrap downloads-inner">
      <div><p class="eyebrow">DOWNLOAD</p><h2 id="downloads-title">${copy.downloadsTitle}</h2><p>${copy.downloadsIntro}</p><a class="button primary" href="${releases}">${copy.allDownloads}<span aria-hidden="true">↗</span></a></div>
      <div><div class="table-scroll"><table><thead><tr>${copy.tableHeaders.map((header) => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">Windows</th><td>x64 / ARM64</td><td>EXE · ZIP</td></tr><tr><th scope="row">macOS</th><td>Intel / Apple Silicon</td><td>DMG · ZIP</td></tr><tr><th scope="row">Linux</th><td>x64 / ARM64</td><td>AppImage · DEB · RPM · tar.gz<br>Snap (x64)</td></tr></tbody></table></div><p class="fine-print">${copy.checksum}</p><p class="fine-print">${copy.unsigned}</p></div>
    </div></section>
    <section class="faq wrap" aria-labelledby="faq-title"><h2 id="faq-title">${copy.faqTitle}</h2><div class="faq-list">${copy.questions.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div><div class="doc-links"><a href="${repository}/blob/textpack/docs/textpack.md">${copy.documentation} ↗</a><a href="https://textbundle.org/spec/">${copy.standard} ↗</a></div></section>
  </main>
  <footer class="wrap"><p>${copy.footer}</p><div><a href="https://github.com/marktext/marktext">MarkText ↗</a><a href="${repository}/blob/textpack/LICENSE">MIT</a><a href="${repository}/issues">Issues ↗</a></div></footer>
</body>
</html>
`
  const directory = key === 'en' ? path.join(output, 'en') : output
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'index.html'), html)
}

writeFileSync(path.join(output, '.nojekyll'), '')
writeFileSync(
  path.join(output, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${baseUrl}</loc></url><url><loc>${baseUrl}en/</loc></url></urlset>
`
)
console.log(`Built Chinese and English project pages in ${output}`)
