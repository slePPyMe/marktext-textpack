<p align="center"><img src="docs/assets/logo-small.png" alt="MarkText" width="100" height="100"></p>

<h1 align="center">MarkText TextPack</h1>

> [!IMPORTANT]
> This is an unofficial fork of [MarkText](https://github.com/marktext/marktext).
> It is independently maintained and is not an official MarkText release.

## MarkText TextPack

**Keep Markdown and local images together in one editable file.** MarkText
TextPack is an open-source Markdown editor with native `.textpack` support.
Move, share or synchronize a document without losing its bundled local images,
then reopen it and continue editing with MarkText's WYSIWYG editor.

**把 Markdown 正文和本地图片保存成一个可继续编辑的文件。** 本分支为 MarkText
增加原生 `.textpack` 支持，适合图文笔记的移动、分享和同步：不用同时管理独立的
图片文件夹，也不用把图片转成冗长的 Base64 文本。保留所见即所得与源码编辑体验。

**[Download TextPack builds / 下载 TextPack 版（Windows x64）](https://github.com/slePPyMe/marktext-textpack/releases/latest)**
· [简体中文说明](docs/i18n/README-zh_cn.md)

Local images are bundled; HTTP/HTTPS images stay remote. This is an independent,
unofficial fork, and the official MarkText downloads do not include these changes.

### Features

- Open, edit, save, and restore `.textpack` documents.
- Store pasted and dropped images in the package's `assets/` directory.
- Convert Markdown documents to TextPack while embedding Base64 and local resources.
- Export TextPack documents back to Markdown with their assets.
- Preserve compatible metadata, existing assets, and unknown package files.
- Detect unsafe archives and external file changes.

### Current scope

- `.textbundle` directories are not supported.
- No generic attachment insertion UI is added.
- Remote HTTP/HTTPS resources remain remote.
- Development follows upstream `develop`; downloads follow upstream stable release tags.

See [TextPack documentation](docs/textpack.md) for compatibility details and
current limitations.

### Upstream synchronization

The `Release TextPack` workflow checks for a new upstream stable release every
15 minutes, merges its exact tag into `textpack-stable`, and publishes matching
version numbers after checks and packaging pass. Detection, runner queues and
build time mean publication follows upstream rather than occurring simultaneously.
Source conflicts stop publication. See [release maintenance](docs/textpack-release.md).

The separate `Sync upstream` development workflow can rebase `textpack` onto
upstream `develop`. Its weekly schedule runs only while that workflow is enabled
in repository Actions; the release workflow does not enable it. It runs lint,
type checks and unit tests before updating `textpack`, with a remote-head check.
Conflicts stop for manual resolution.

The push uses a dedicated SSH deploy key with write access to this repository,
stored in the Actions secret `SYNC_UPSTREAM_SSH_KEY`. This also allows upstream
workflow changes, which the default `GITHUB_TOKEN` cannot push. The key is used
only after checks pass, with strict GitHub host-key verification, and its temporary
file is removed when the push step ends. It is not persisted in the checkout.
The built-in token has read-only access.

To rotate the credential, add a new write-enabled key in repository **Settings →
Deploy keys**, replace `SYNC_UPSTREAM_SSH_KEY` with its private key, verify a manual
sync, then remove the old deploy key. Deploy keys do not expire automatically.
Never paste private keys into issues, chat, or source files.

The implementation was developed with AI assistance and manually reviewed and tested.

<div align="center">
  <a href="https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20app?&hashtags=happyMarkText">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness: Next generation markdown editor :crescent_moon:</strong><br>
  A simple and elegant open-source markdown editor that focused on speed and usability.<br>
  <sub>Available for Linux, macOS and Windows.</sub>
</div>

<br>

<div align="center">
  <!-- License -->
  <a href="LICENSE">
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
    <a href="https://marktext.me">
      Website
    </a>
    <span> | </span>
    <a href="#features">
      Features
    </a>
    <span> | </span>
    <a href="#download-and-installation">
      Downloads
    </a>
    <span> | </span>
    <a href="#development">
      Development
    </a>
    <span> | </span>
    <a href="#contribution">
      Contribution
    </a>
  </h3>
</div>

<div align="center">
  <sub>Translations:</sub>
  <a href="docs/i18n/README-zh_cn.md#readme">
    <span>:cn:</span>
  </a>
  <a href="docs/i18n/README-zh_tw.md#readme">
    <span>:taiwan:</span>
  </a>
  <a href="docs/i18n/README-jp.md#readme">
    <span>:jp:</span>
  </a>
  <a href="docs/i18n/README-fr.md#readme">
    <span>:fr:</span>
  </a>
  <a href="docs/i18n/README-tr.md#readme">
    <span>:tr:</span>
  </a>
  <a href="docs/i18n/README-es.md#readme">
    <span>:es:</span>
  </a>
  <a href="docs/i18n/README-pt.md#readme">
    <span>:portugal:</span>
  </a>
  <a href="docs/i18n/README-kr.md#readme">
    <span>:kr:</span>
  </a>
  <a href="docs/i18n/README-bn.md#readme">
    <span>:bangladesh:</span>
  </a>
</div>

<div align="center">
  <sub>This Markdown editor that could. Built with ❤︎ by
    <a href="https://github.com/Jocs">Jocs</a> and
    <a href="https://github.com/marktext/marktext/graphs/contributors">
      contributors
    </a>
    .
  </sub>
</div>

<br />

<h2 align="center">Sponsors</h2>

MarkText is an open-source Markdown editor powered by the support of its community. If MarkText improves your workflow, please consider [sponsoring the project](https://github.com/sponsors/marktext). Thank you to all the sponsors ❤️

**Special Sponsor**

<table>
<tr>
<td width="182"><a href="https://serpapi.com/?utm_source=marktext"><img src="docs/assets/sponsors/serpapi.png" width="150"></a></td>
<td align="left"><a href="https://serpapi.com/?utm_source=marktext">Scrape Google and other search engines from our fast, easy, and complete API.</a></td>
</tr>
</table>

<!-- current-sponsors:start -->

**Current Sponsors**

[![Current sponsors](docs/assets/sponsors/current.svg)](https://github.com/sponsors/marktext)

<!-- current-sponsors:end -->

## Screenshot

![](docs/assets/marktext.png?raw=true)

## Features

- Realtime preview (WYSIWYG) and a clean and simple interface to get a distraction-free writing experience.
- Support [CommonMark Spec](https://spec.commonmark.org), [GitHub Flavored Markdown Spec](https://github.github.com/gfm/) and selective support [Pandoc markdown](https://pandoc.org/MANUAL.html#pandocs-markdown).
- Markdown extensions such as math expressions (KaTeX), front matter and emojis.
- Support paragraphs and inline style shortcuts to improve your writing efficiency.
- Output **HTML** and **PDF** files.
- Various [themes](https://marktext.me/docs/themes): **Cadmium Light**, **Material Dark** etc.
- Various editing modes: **Source Code mode**, **Typewriter mode**, **Focus mode**.
- Paste images directly from clipboard.

## Download and Installation

Download from **[this fork's Releases](https://github.com/slePPyMe/marktext-textpack/releases/latest)**.
Versions follow the upstream stable release. Choose a Windows x64 asset:

| File                                            | Use                                 |
| ----------------------------------------------- | ----------------------------------- |
| `marktext-textpack-win-x64-<version>-setup.exe` | Windows installer                   |
| `marktext-textpack-win-x64-<version>.zip`       | Extract and run `marktext.exe`      |
| `SHA256SUMS.txt`                                | SHA-256 checksums for the downloads |

Builds are unsigned and retain MarkText's application identity and settings path.
The official MarkText releases and package-manager commands install the upstream
application rather than this TextPack fork. Linux, macOS and ARM64 builds are
not currently published by the TextPack workflow.

To create a TextPack, open a Markdown document, choose **File → Save As**, and
save with the `.textpack` extension. Referenced local images are collected into
the file. See [TextPack documentation](docs/textpack.md) for format limitations
and [publishing instructions](docs/textpack-release.md) for the upstream-following release
workflow.

## Development

If you wish to build MarkText yourself, please check out our [build instructions](https://marktext.me/docs/dev/build).

- [User documentation](https://marktext.me/docs/introduction)
- [Developer documentation](https://marktext.me/docs/dev/overview)

If you have any questions regarding MarkText, you are welcome to write an issue. When doing so please use the default format found when opening an issue. Of course, if you submit a PR directly, it will be greatly appreciated.

## Contribution

MarkText is in development, please make sure to read the [Contributing Guide](.github/CONTRIBUTING.md) before making a pull request. Want to add some features to MarkText? Refer to our [roadmap](https://github.com/marktext/marktext/projects) and open issues.

## Contributors

Thank you to all the people who have already contributed to MarkText[[contributors](https://github.com/marktext/marktext/graphs/contributors)].

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>

## License

[**MIT**](LICENSE).
