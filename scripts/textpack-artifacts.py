import argparse
import base64
import hashlib
import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

import yaml

REPOSITORY = 'slePPyMe/marktext-textpack'
UPSTREAM = 'marktext/marktext'
UPDATE_URL = f'https://github.com/{REPOSITORY}/releases/latest/download/'


def github(route):
    request = urllib.request.Request(
        f'https://api.github.com/repos/{route}',
        headers={
            'Accept': 'application/vnd.github+json',
            'Authorization': f'Bearer {os.environ["GH_TOKEN"]}',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def platform_files(platform, arch, version):
    if platform == 'windows':
        prefix = f'marktext-textpack-win-{arch}-{version}'
        return [f'{prefix}-setup.exe', f'{prefix}-setup.exe.blockmap', f'{prefix}.zip']
    if platform == 'macos':
        prefix = f'marktext-textpack-mac-{arch}-{version}'
        return [f'{prefix}.dmg', f'{prefix}.dmg.blockmap', f'{prefix}.zip', f'{prefix}.zip.blockmap']
    if platform == 'linux':
        architecture = '-arm64' if arch == 'arm64' else ''
        prefix = f'marktext-textpack-linux{architecture}-{version}'
        extensions = ['AppImage', 'deb', 'rpm', 'tar.gz']
        if arch == 'x64':
            extensions.append('snap')
        return [f'{prefix}.{extension}' for extension in extensions]
    raise ValueError(f'Unknown platform: {platform}')


def manifest_name(platform, arch):
    if platform == 'windows':
        return 'latest.yml'
    if platform == 'macos':
        return 'latest-mac.yml'
    return 'latest-linux-arm64.yml' if arch == 'arm64' else 'latest-linux.yml'


def digest(path, algorithm):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, algorithm).digest()


def narrow_manifest(document, names, version):
    if document['version'] != version:
        raise ValueError('Existing update metadata has a different version')
    files = [entry for entry in document['files'] if entry['url'] in names]
    if not files:
        raise ValueError('Existing update metadata is missing this architecture')
    result = dict(document)
    result['files'] = files
    fallback = next((entry for entry in files if entry['url'] == document.get('path')), files[0])
    result['path'] = fallback['url']
    result['sha512'] = fallback['sha512']
    return result


def verify_manifest(path, directory, version):
    document = yaml.safe_load(path.read_text(encoding='utf-8-sig'))
    if document['version'] != version:
        raise ValueError(f'{path.name}: version mismatch')
    for entry in document['files']:
        name = entry['url']
        if Path(name).name != name or '/' in name or '\\' in name:
            raise ValueError(f'{path.name}: unsafe asset path')
        file = directory / name
        if not file.is_file() or file.stat().st_size != entry['size']:
            raise ValueError(f'{path.name}: missing or truncated {name}')
        if base64.b64encode(digest(file, 'sha512')).decode() != entry['sha512']:
            raise ValueError(f'{path.name}: incorrect checksum for {name}')


def download_asset(asset, destination):
    request = urllib.request.Request(asset['browser_download_url'])
    with urllib.request.urlopen(request, timeout=120) as response, destination.open('wb') as stream:
        shutil.copyfileobj(response, stream)
    if destination.stat().st_size != asset['size']:
        raise ValueError(f'{destination.name}: download was truncated')
    expected = asset.get('digest')
    if expected and expected != f'sha256:{digest(destination, "sha256").hex()}':
        raise ValueError(f'{destination.name}: GitHub asset checksum mismatch')


def reuse(args):
    try:
        release = github(f'{REPOSITORY}/releases/tags/{args.tag}')
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        release = {'assets': []}
    by_name = {asset['name']: asset for asset in release['assets']}
    names = platform_files(args.platform, args.arch, args.version)
    available = [name for name in names if name in by_name]
    if available and len(available) != len(names):
        raise ValueError(f'Existing {args.platform}/{args.arch} assets are incomplete; review before rebuilding')
    reused = bool(available)
    if reused:
        args.directory.mkdir(parents=True, exist_ok=True)
        metadata_name = manifest_name(args.platform, args.arch)
        for name in names + [metadata_name]:
            download_asset(by_name[name], args.directory / name)
        path = args.directory / metadata_name
        document = yaml.safe_load(path.read_text(encoding='utf-8-sig'))
        path.write_text(yaml.safe_dump(narrow_manifest(document, names, args.version), sort_keys=False))
        verify_manifest(path, args.directory, args.version)
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
        output.write(f'reused={str(reused).lower()}\n')
    print(f'{args.platform}/{args.arch}: {"reuse verified published binaries" if reused else "build required"}')


def verify_platform(args):
    for name in platform_files(args.platform, args.arch, args.version):
        if not (args.directory / name).is_file():
            raise ValueError(f'Missing package: {name}')
    verify_manifest(args.directory / manifest_name(args.platform, args.arch), args.directory, args.version)
    feeds = list(args.directory.rglob('app-update.yml'))
    if not feeds:
        raise ValueError('Packaged application update configuration is missing')
    for path in feeds:
        feed = yaml.safe_load(path.read_text(encoding='utf-8-sig'))
        if feed.get('provider') != 'generic' or feed.get('url') != UPDATE_URL:
            raise ValueError(f'{path}: updater must use the TextPack fork')


def verify_release(args):
    upstream = github(f'{UPSTREAM}/releases/tags/v{args.version}')
    expected = {asset['name'].replace('marktext-', 'marktext-textpack-', 1) for asset in upstream['assets']}
    actual = {file.name for file in args.directory.iterdir() if file.is_file()}
    missing = expected - actual - {'SHA256SUMS.txt'}
    extra = actual - expected
    if missing or extra:
        raise ValueError(f'Release types differ from upstream: missing={sorted(missing)}, extra={sorted(extra)}')
    for name in ['latest.yml', 'latest-mac.yml', 'latest-linux.yml', 'latest-linux-arm64.yml']:
        verify_manifest(args.directory / name, args.directory, args.version)
    files = sorted(file for file in args.directory.iterdir() if file.name != 'SHA256SUMS.txt')
    checksums = ''.join(f'{digest(file, "sha256").hex()}  {file.name}\n' for file in files)
    (args.directory / 'SHA256SUMS.txt').write_text(checksums, encoding='utf-8')
    print(f'Verified {len(expected)} release assets with the same package types as upstream')


def notes(args):
    upstream = github(f'{UPSTREAM}/releases/tags/v{args.version}')
    source = os.environ['BUILD_COMMIT']
    packaging = os.environ['WORKFLOW_COMMIT']
    text = f'''Unofficial MarkText TextPack **{args.version}**, based on the complete upstream stable release.
基于上游完整正式版 **{args.version}** 的非官方 TextPack 版，把 Markdown 和本地图片保存在一个可继续编辑的文件中。

## Downloads / 下载

| Platform / 平台 | Architecture / 架构 | Packages / 安装包 |
| --- | --- | --- |
| Windows | x64, ARM64 | Installer EXE, ZIP |
| macOS | Intel x64, Apple Silicon ARM64 | DMG, ZIP |
| Linux | x64 | AppImage, DEB, RPM, Snap, tar.gz |
| Linux | ARM64 | AppImage, DEB, RPM, tar.gz |

Choose files beginning with `marktext-textpack-`. Update metadata, blockmaps and `SHA256SUMS.txt` accompany the packages.
请选择以 `marktext-textpack-` 开头的文件；校验和见 `SHA256SUMS.txt`。

## TextPack

Open Markdown and use **File → Save As** with the `.textpack` extension. Local images are bundled; HTTP/HTTPS images remain remote. Reopen the file to continue editing. `.textbundle` directories are not supported.
打开 Markdown，通过「文件 → 另存为」保存为 `.textpack`，即可打包本地图片并继续编辑。在线图片仍保留远程引用，暂不支持 `.textbundle` 目录。

Builds are unsigned and retain MarkText's application identity and settings path. On macOS, after dragging MarkText into Applications, follow the upstream unsigned-build instructions:

```sh
xattr -d com.apple.quarantine /Applications/MarkText.app
```

## Upstream changes / 上游更新

This build includes upstream {args.version}. [Read the complete upstream release notes]({upstream['html_url']}).
本版包含相应上游正式版的更新；完整功能与修复列表见上方上游发布说明。

- [Project and usage / 项目与使用说明](https://sleppyme.github.io/marktext-textpack/)
- Upstream publication / 上游发布时间: {upstream['published_at']}
- Upstream commit: `{os.environ['UPSTREAM_COMMIT']}`
- [Application source / 应用源码](https://github.com/{REPOSITORY}/commit/{source})
- [Packaging workflow / 打包流程](https://github.com/{REPOSITORY}/commit/{packaging})

Existing published binaries are retained when completing a release. Additional platforms use the same application source and the packaging workflow recorded above.
补齐发布时保留已公开的程序文件；新增平台使用上述同一应用源码及所记录的打包流程。
'''
    args.notes.write_text(text, encoding='utf-8')


def publish(args):
    try:
        release = github(f'{REPOSITORY}/releases/tags/{args.tag}')
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        subprocess.run([
            'gh', 'release', 'create', args.tag, '--repo', REPOSITORY, '--verify-tag',
            '--title', f'MarkText TextPack v{args.version}', '--notes-file', str(args.notes), '--draft',
        ], check=True)
        release = github(f'{REPOSITORY}/releases/tags/{args.tag}')
    if release.get('immutable'):
        raise ValueError('Cannot add assets to an immutable release')
    if not release['draft'] and not args.complete_existing:
        raise ValueError('Completing a published release requires explicit workflow input')
    by_name = {asset['name']: asset for asset in release['assets']}
    files = sorted(args.directory.iterdir(), key=lambda file: (file.name == 'SHA256SUMS.txt', file.suffix == '.yml', file.name))
    for file in files:
        previous = by_name.get(file.name)
        metadata = file.suffix == '.yml' or file.name == 'SHA256SUMS.txt'
        if previous and not release['draft'] and not metadata:
            expected = previous.get('digest')
            if not expected:
                raise ValueError(f'{file.name}: cannot verify an existing binary without a GitHub digest')
            if expected != f'sha256:{digest(file, "sha256").hex()}':
                raise ValueError(f'{file.name}: refusing to overwrite a published binary')
            print(f'Preserved published binary: {file.name}')
            continue
        command = ['gh', 'release', 'upload', args.tag, str(file), '--repo', REPOSITORY]
        if previous:
            command.append('--clobber')
        subprocess.run(command, check=True)
    subprocess.run(['gh', 'release', 'edit', args.tag, '--repo', REPOSITORY, '--notes-file', str(args.notes)], check=True)
    if args.publish and release['draft']:
        subprocess.run(['gh', 'release', 'edit', args.tag, '--repo', REPOSITORY, '--draft=false'], check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['reuse', 'verify-platform', 'verify-release', 'notes', 'publish'])
    parser.add_argument('--version', required=True)
    parser.add_argument('--platform', choices=['windows', 'macos', 'linux'])
    parser.add_argument('--arch', choices=['x64', 'arm64'])
    parser.add_argument('--tag')
    parser.add_argument('--directory', type=Path, default=Path('dist'))
    parser.add_argument('--notes', type=Path, default=Path('release-notes.md'))
    parser.add_argument('--complete-existing', action='store_true')
    parser.add_argument('--publish', action='store_true')
    arguments = parser.parse_args()
    {'reuse': reuse, 'verify-platform': verify_platform, 'verify-release': verify_release, 'notes': notes, 'publish': publish}[arguments.operation](arguments)
