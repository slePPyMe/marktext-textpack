<p align="center"><img src="../assets/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText TextPack</h1>

> [!IMPORTANT]
> 这是独立维护的非官方 MarkText 分支，增加原生 `.textpack` 图文文档支持。
> 官方 MarkText 的安装包不包含此分支的功能。

**把 Markdown 正文和本地图片保存成一个可继续编辑的文件。** 移动、分享或同步
图文笔记时，不必同时携带图片文件夹；重新打开 `.textpack` 后仍可继续所见即所得
编辑。支持粘贴、拖入图片，以及 Markdown 与 TextPack 之间的另存为转换。
HTTP/HTTPS 图片保留远程引用，当前不支持 `.textbundle` 目录。

**[下载 TextPack 版（Windows · macOS · Linux）](https://github.com/slePPyMe/marktext-textpack/releases/latest)**
· [项目介绍](https://sleppyme.github.io/marktext-textpack/)
· [格式与限制](../textpack.md) · [英文说明](../../README.md)

<div align="center">
  <a href="https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20app?&hashtags=happyMarkText">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness: 下一代 Markdown 编辑器 :crescent_moon:</strong><br>
  一款专注于速度和易用性的简洁优雅的开源 Markdown 编辑器。<br>
  <sub>支持 Linux、macOS 和 Windows。</sub>
</div>

<br>

<div align="center">
  <!-- License -->
  <a href="../../LICENSE">
    <img src="https://img.shields.io/github/license/marktext/marktext.svg" alt="LICENSE">
  </a>
  <!-- Downloads total -->
  <a href="https://github.com/slePPyMe/marktext-textpack/releases">
    <img src="https://img.shields.io/github/downloads/slePPyMe/marktext-textpack/total.svg" alt="total download">
  </a>
  <!-- Downloads latest release -->
  <a href="https://github.com/slePPyMe/marktext-textpack/releases">
    <img src="https://img.shields.io/github/downloads/slePPyMe/marktext-textpack/latest/total.svg" alt="latest download">
  </a>
  <!-- sponsors -->
  <a href="https://opencollective.com/marktext">
    <img src="https://opencollective.com/marktext/tiers/silver-sponsors/badge.svg?label=SilverSponsors&color=brightgreen" alt="sponsors">
  </a>
</div>

<div align="center">
  <h3>
    <a href="https://sleppyme.github.io/marktext-textpack/">
      Website
    </a>
    <span> | </span>
    <a href="#功能">
      功能
    </a>
    <span> | </span>
    <a href="#下载与安装">
      下载与安装
    </a>
    <span> | </span>
    <a href="#开发">
      开发
    </a>
    <span> | </span>
    <a href="#贡献">
      贡献
    </a>
  </h3>
</div>

<div align="center">
  <sub>其他语言翻译：</sub>
  <a href="../../README.md">
    <span>:uk:</span>
  </a>
  <a href="README-zh_tw.md#readme">
    <span>:taiwan:</span>
  </a>
  <a href="README-de.md#readme">
    <span>:de:</span>
  </a>
  <a href="README-jp.md#readme">
    <span>:jp:</span>
  </a>
  <a href="README-fr.md#readme">
    <span>:fr:</span>
  </a>
  <a href="README-tr.md#readme">
    <span>:tr:</span>
  </a>
  <a href="README-es.md#readme">
    <span>:es:</span>
  </a>
  <a href="README-pt.md#readme">
    <span>:portugal:</span>
  </a>
  <a href="README-kr.md#readme">
    <span>:kr:</span>
  </a>
  <a href="README-ar.md#readme">
    <span>:saudi_arabia:</span>
  </a>
  <a href="README-bn.md#readme">
    <span>:bangladesh:</span>
  </a>
</div>

<div align="center">
  <sub>这款 Markdown 编辑器由
    <a href="https://github.com/Jocs">Jocs</a> 和
    <a href="https://github.com/marktext/marktext/graphs/contributors">
      贡献者们
    </a>
    用 ❤︎ 构建。</sub>
</div>

<br />

<h2 align="center">支持 MarkText</h2>

MarkText 是一款由社区支持驱动的开源 Markdown 编辑器。如果 MarkText 改善了您的工作流程，请考虑[赞助本项目](https://github.com/sponsors/marktext)。感谢所有赞助者 ❤️

**特别赞助商**

<table>
<tr>
<td width="182"><a href="https://serpapi.com/?utm_source=marktext"><img src="../assets/sponsors/serpapi.png" width="150"></a></td>
<td align="left"><a href="https://serpapi.com/?utm_source=marktext">通过我们快速、便捷且完整的 API 抓取 Google 及其他搜索引擎的数据。</a></td>
</tr>
</table>

## 截图

![](../assets/marktext.png?raw=true)

## 功能

- 实时预览（所见即所得）及简洁清爽的界面，带来无干扰的写作体验。
- 支持 [CommonMark 规范](https://spec.commonmark.org)、[GitHub Flavored Markdown 规范](https://github.github.com/gfm/)，并选择性支持 [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown)。
- 支持数学表达式（KaTeX）、Front Matter 和表情符号等 Markdown 扩展。
- 支持段落和内联样式快捷方式，提升写作效率。
- 可导出 **HTML** 和 **PDF** 文件。
- 多种[主题](https://marktext.me/docs/themes)：**Cadmium Light**、**Material Dark** 等。
- 多种编辑模式：**源代码模式**、**打字机模式**、**专注模式**。
- 支持直接从剪贴板粘贴图片。

## 下载与安装

请从 **[本分支 Releases](https://github.com/slePPyMe/marktext-textpack/releases/latest)** 下载，
版本号跟随上游正式 Release，当前提供 Windows x64 构建：

| 文件                                         | 用途                      |
| -------------------------------------------- | ------------------------- |
| `marktext-textpack-win-x64-<版本>-setup.exe` | Windows 安装包            |
| `marktext-textpack-win-x64-<版本>.zip`       | 解压后运行 `marktext.exe` |
| `SHA256SUMS.txt`                             | 下载文件的 SHA-256 校验和 |

构建未签名，沿用 MarkText 的应用标识与设置目录。官方 MarkText 发布页以及
Homebrew、Winget、Chocolatey 的官方包不包含此分支功能；当前 TextPack 工作流
尚未发布 Linux、macOS 或 ARM64 安装包。

打开 Markdown 文档后，选择「文件 → 另存为」，使用 `.textpack` 扩展名，即可将
正文和引用的本地图片打包。具体兼容范围见[格式说明](../textpack.md)，
自动跟随上游发版的规则与维护步骤见[发布流程](../textpack-release.md)。

## 开发

如果你希望自行构建 MarkText，请参阅我们的[构建说明](https://marktext.me/docs/dev/build)。

- [用户文档](https://marktext.me/docs/introduction)
- [开发者文档](https://marktext.me/docs/dev/overview)

如果你对 MarkText 有任何疑问，欢迎提交 issue。提交时请使用打开 issue 时的默认格式。当然，如果你直接提交 PR，将不胜感激。

## 贡献

MarkText 正在开发中，请在提交 pull request 之前确保阅读[贡献指南](../../.github/CONTRIBUTING.md)。想为 MarkText 添加新功能？请参阅我们的[路线图](https://github.com/marktext/marktext/projects)和开放 issue。

## 贡献者

感谢所有已经为 MarkText 做出贡献的人[[贡献者](https://github.com/marktext/marktext/graphs/contributors)]。

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>

## 许可证

[**MIT**](../../LICENSE).
