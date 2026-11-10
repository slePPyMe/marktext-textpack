# TextPack releases following upstream

Download from [this fork's latest release](https://github.com/slePPyMe/marktext-textpack/releases/latest).
Application versions match upstream stable releases, such as `0.23.0`.
Release titles and asset names identify the unofficial TextPack build.

## Automatic publication

`Release TextPack` checks the upstream latest stable release every 15 minutes.
When a new release appears, it merges the exact upstream tag into the separate
`textpack-stable` branch, runs checks, and builds the same six platform and
architecture combinations as upstream: Windows, macOS and Linux, each for x64
and ARM64.
It publishes only after all checks, packaging and asset verification succeed.

Publication follows upstream; it is not simultaneous. GitHub schedule and runner
delays plus the time for tests and builds determine the actual publication time.
Release notes record the upstream publication time and both source commits.
An existing release or draft is left alone, and an upstream merge conflict stops
the run for manual review. Unchanged upstream releases do not trigger builds.

The main `textpack` branch remains the development branch following upstream
`develop`. Stable downloads are built from `textpack-stable`, not by relabeling
development code with the latest stable version number. TextPack-specific fixes
must be ported to that stable branch before the next release; the automated
merge incorporates upstream changes only.

## Manual run and recovery

Open [Release TextPack](https://github.com/slePPyMe/marktext-textpack/actions/workflows/release-textpack.yml)
and choose **Run workflow** on `textpack`:

- Leave **upstream_tag** empty for the latest stable release, or enter an actual
  published stable tag such as `v0.23.0`.
- **publish** is enabled by default. Disable it to upload a draft for review.
- Enable **complete_existing** only to add missing platforms to an existing
  mutable release. Published binaries are downloaded and checksum-verified for
  reuse; they are never replaced. Update metadata and checksums are regenerated
  after all six platform artifacts pass verification. Immutable releases cannot
  be completed in place.
- After a merge conflict, resolve it on `textpack-stable`, run the checks, and
  retry. After an upload failure, rerun the failed release job; draft assets can
  be completed without changing an already-published release.

Fork tags use `textpack-vX.Y.Z` to avoid collisions with fetched upstream tags.
The application and installer version remain exactly `X.Y.Z`. Source tags point
to the actual checked build commit. The stable branch and tag are pushed together
only after the build passes, without force-pushing.

The existing repository-scoped `SYNC_UPSTREAM_SSH_KEY` deploy key is reused only
for that final push. `GITHUB_TOKEN` reads releases and publishes assets. There
is no new credential or repository setting to configure when the existing key
is valid. Development synchronization remains a separate workflow and is not
enabled by the release process.

## Packages and updates

`packages/desktop/electron-builder.textpack.yml` inherits upstream packaging
behavior. Downloads have a `marktext-textpack-` prefix. The bundled updater uses
this fork's `/releases/latest/download/` feed and `latest.yml`, independently of
the fork tag prefix and the official MarkText update feed.

Downloads match upstream package types: Windows NSIS installer and ZIP; macOS
DMG and ZIP; Linux AppImage, DEB, RPM and tar.gz, plus Snap on x64. Architecture
metadata is merged before upload and its file sizes and SHA-512 checksums are
verified. The final asset list is compared with the exact upstream release,
with a `marktext-textpack-` prefix for application packages.

Builds are unsigned and retain MarkText's application identity, executable name
and settings path. Automatic installation of an update still needs validation
between two published TextPack versions.

Existing release tags keep their application source commit when completing
platform coverage. The triggering workflow provides the packaging configuration;
release notes record both commits. Future releases include the packaging files in
their prepared source commit. No application code is relabeled or tag replaced.

## 中文说明

版本号与上游正式版一致；发布名称和安装包文件名带有 TextPack 标识。
工作流每 15 分钟检查一次上游新版本，以相应正式标签为基础合并 TextPack 改动，
通过检查和打包后自动发布。发布时间会受检测间隔、队列和构建耗时影响，晚于上游。

平台和包类型与上游一致：Windows、macOS、Linux 均提供 x64/ARM64；Linux Snap
与上游一样仅提供 x64。手动补齐已有版本时启用 `complete_existing`，保留并校验
已发布的程序文件，新增缺失平台，最后重新合并自动更新元数据与校验和。

开发分支为 `textpack`，稳定发布源码位于 `textpack-stable`，Git 标签为
`textpack-vX.Y.Z`，应用版本仍为 `X.Y.Z`。合并冲突时停止，已有 Release 或草稿
不会被自动覆盖。需要手动运行时，在 Actions 中选择 **Release TextPack**。
