import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const forkRepository = 'slePPyMe/marktext-textpack'
const upstreamRepository = 'marktext/marktext'
const stableBranch = 'textpack-stable'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const requestGitHub = async (route, allowMissing = false) => {
  const response = await fetch(`https://api.github.com/repos/${route}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (allowMissing && response.status === 404) return null
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status} (${route})`)
  return response.json()
}

export const findRelease = async (request = requestGitHub, requestedTag = '') => {
  const route = requestedTag ? `tags/${encodeURIComponent(requestedTag)}` : 'latest'
  const upstream = await request(`${upstreamRepository}/releases/${route}`)
  if (
    upstream.draft ||
    upstream.prerelease ||
    !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(upstream.tag_name)
  ) {
    throw new Error('Only published upstream stable releases are supported')
  }
  const version = upstream.tag_name.slice(1)
  const tag = `textpack-v${version}`
  const existing = await request(`${forkRepository}/releases/tags/${tag}`, true)
  return {
    needed: !existing,
    version,
    tag,
    upstream_tag: upstream.tag_name,
    upstream_published_at: upstream.published_at,
    upstream_url: upstream.html_url
  }
}

export const prepareRelease = () => {
  const upstreamTag = process.env.UPSTREAM_TAG
  const version = process.env.RELEASE_VERSION
  if (
    upstreamTag !== `v${version}` ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
  ) {
    throw new Error('Release version must exactly match the upstream stable tag')
  }
  const workflowCommit = git('rev-parse', 'HEAD')
  git('fetch', '--no-tags', 'origin', `refs/heads/${stableBranch}`)
  const stableHead = git('rev-parse', 'FETCH_HEAD')
  git(
    'fetch',
    '--no-tags',
    `https://github.com/${upstreamRepository}.git`,
    `refs/tags/${upstreamTag}`
  )
  const upstreamHead = git('rev-parse', 'FETCH_HEAD^{commit}')
  const releaseRef = `refs/tags/textpack-v${version}`
  const existingTag = git('ls-remote', '--tags', 'origin', releaseRef)
  if (existingTag) {
    git('fetch', '--no-tags', 'origin', releaseRef)
    const buildCommit = git('rev-parse', 'FETCH_HEAD^{commit}')
    git('checkout', '--detach', buildCommit)
    git('merge-base', '--is-ancestor', upstreamHead, buildCommit)
    const desktop = JSON.parse(readFileSync('packages/desktop/package.json', 'utf8'))
    if (desktop.version !== version) {
      throw new Error('Existing release tag has an unexpected version')
    }
    git('bundle', 'create', 'release-source.bundle', 'HEAD')
    return {
      build_commit: buildCommit,
      stable_head: stableHead,
      upstream_commit: upstreamHead,
      workflow_commit: workflowCommit,
      tag_exists: true
    }
  }
  git('checkout', '--detach', stableHead)
  git('config', 'user.name', 'github-actions[bot]')
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
  try {
    git('merge', '--no-commit', '--no-ff', upstreamHead)
  } catch {
    const unresolved = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean)
    const sourceConflicts = unresolved.filter(
      (file) =>
        !file.startsWith('.github/') && file !== 'README.md' && file !== 'docs/i18n/README-zh_cn.md'
    )
    if (sourceConflicts.length || !unresolved.length) {
      throw new Error(
        `Upstream merge requires review: ${sourceConflicts.join(', ') || 'merge failed'}`
      )
    }
  }
  // Release code follows the stable tag; automation follows the triggering default-branch commit.
  git('rm', '-r', '-f', '--ignore-unmatch', '.github')
  git(
    'checkout',
    workflowCommit,
    '--',
    '.github',
    'README.md',
    'docs/i18n/README-zh_cn.md',
    'docs/textpack-release.md',
    'packages/desktop/electron-builder.textpack.yml',
    'scripts/textpack-release.mjs',
    'scripts/tests/textpack-release.test.mjs'
  )
  const unresolved = git('diff', '--name-only', '--diff-filter=U')
  if (unresolved) throw new Error(`Unresolved release merge: ${unresolved}`)
  const desktop = JSON.parse(readFileSync('packages/desktop/package.json', 'utf8'))
  if (desktop.version !== version) {
    throw new Error(`Source version ${desktop.version} does not match upstream ${version}`)
  }
  git('commit', '--no-verify', '--allow-empty', '-m', `release: prepare TextPack ${version}`)
  const buildCommit = git('rev-parse', 'HEAD')
  git('bundle', 'create', 'release-source.bundle', 'HEAD', `^${stableHead}`)
  return {
    build_commit: buildCommit,
    stable_head: stableHead,
    upstream_commit: upstreamHead,
    workflow_commit: workflowCommit,
    tag_exists: false
  }
}

const writeOutputs = (values) => {
  for (const [key, value] of Object.entries(values)) {
    const text = String(value)
    if (/[\r\n]/.test(text)) throw new Error(`Invalid multiline workflow output: ${key}`)
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${text}\n`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (
    process.env.GITHUB_REPOSITORY !== forkRepository ||
    process.env.GITHUB_REF !== 'refs/heads/textpack'
  ) {
    throw new Error('Run the release workflow from this fork’s textpack branch')
  }
  const operation = process.argv[2]
  if (operation === 'poll') {
    const release = await findRelease(requestGitHub, process.env.REQUESTED_TAG || '')
    writeOutputs(release)
    console.log(
      release.needed
        ? `Preparing ${release.tag} from upstream ${release.upstream_tag}`
        : `${release.tag} already exists; no build needed`
    )
  } else if (operation === 'prepare') {
    writeOutputs(prepareRelease())
  } else {
    throw new Error('Expected poll or prepare')
  }
}
