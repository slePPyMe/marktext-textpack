import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

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

export const findRelease = async (
  request = requestGitHub,
  requestedTag = '',
  completeExisting = false
) => {
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
  if (existing?.immutable && completeExisting) {
    throw new Error('The existing release is immutable; its assets cannot be completed')
  }
  return {
    needed: !existing || completeExisting,
    version,
    tag,
    upstream_tag: upstream.tag_name,
    upstream_published_at: upstream.published_at,
    upstream_url: upstream.html_url
  }
}

export const findForkRelease = async (request, upstreamTag, version) => {
  const base = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(upstreamTag)
  if (!base) throw new Error('Specify an exact upstream stable tag for the fork release')
  const [, major, minor, patch] = base
  const [, versionNumber, revision] = /^(\d+\.\d+\.\d+)-textpack\.([1-9]\d*)$/.exec(version) || []
  if (!revision || versionNumber !== `${major}.${minor}.${BigInt(patch) + 1n}`) {
    throw new Error(
      'The fork must use a version between the upstream base and its next stable patch'
    )
  }
  const upstream = await request(`${upstreamRepository}/releases/latest`)
  if (upstream.tag_name !== upstreamTag || upstream.draft || upstream.prerelease) {
    throw new Error('The fork base must still be the latest upstream stable release')
  }
  const latest = await request(`${forkRepository}/releases/latest`)
  if (latest.tag_name !== `textpack-${upstreamTag}`) {
    throw new Error(
      'The latest fork release must be the published counterpart of the upstream base'
    )
  }
  const tag = `textpack-v${version}`
  if (await request(`${forkRepository}/releases/tags/${tag}`, true)) {
    throw new Error(`Release ${tag} already exists`)
  }
  return { needed: true, version, tag, upstream_tag: upstreamTag }
}

const prepareForkRelease = (buildCommit) => {
  if (!/^[0-9a-f]{40}$/.test(buildCommit))
    throw new Error('Specify the full fork source commit SHA')
  const { UPSTREAM_TAG: upstreamTag, RELEASE_VERSION: version } = process.env
  const workflowCommit = git('rev-parse', 'HEAD')
  git('fetch', '--no-tags', 'origin', `refs/heads/${stableBranch}`)
  const stableHead = git('rev-parse', 'FETCH_HEAD')
  git('fetch', '--no-tags', 'origin', `refs/tags/textpack-${upstreamTag}`)
  if (git('rev-parse', 'FETCH_HEAD^{commit}') !== stableHead) {
    throw new Error('The stable branch has moved since the base release')
  }
  git(
    'fetch',
    '--no-tags',
    `https://github.com/${upstreamRepository}.git`,
    `refs/tags/${upstreamTag}`
  )
  const upstreamCommit = git('rev-parse', 'FETCH_HEAD^{commit}')
  git('merge-base', '--is-ancestor', upstreamCommit, stableHead)
  if (git('ls-remote', '--tags', 'origin', `refs/tags/textpack-v${version}`)) {
    throw new Error('The fork release tag already exists')
  }
  git('fetch', '--no-tags', 'origin', buildCommit)
  const stableSource = git('rev-parse', `${buildCommit}^`)
  git('merge-base', '--is-ancestor', stableHead, stableSource)
  if (stableSource === stableHead || git('rev-list', '--merges', `${stableHead}..${buildCommit}`)) {
    throw new Error('The fork source must be a straight-line backport onto the stable release')
  }
  const manifests = ['package.json', 'packages/desktop/package.json']
  const changed = git('diff', '--name-only', stableSource, buildCommit).split('\n').sort()
  if (!isDeepStrictEqual(changed, manifests)) {
    throw new Error('The fork release commit must change only the two version manifests')
  }
  for (const file of manifests) {
    const original = JSON.parse(git('show', `${stableSource}:${file}`))
    const fork = JSON.parse(git('show', `${buildCommit}:${file}`))
    if (
      original.version !== upstreamTag.slice(1) ||
      fork.version !== version ||
      !isDeepStrictEqual(original, { ...fork, version: original.version })
    ) {
      throw new Error(`Unexpected fork version change in ${file}`)
    }
  }
  git('checkout', '--detach', buildCommit)
  git('bundle', 'create', 'release-source.bundle', 'HEAD', `^${stableHead}`)
  return {
    build_commit: buildCommit,
    stable_head: stableHead,
    stable_source: stableSource,
    upstream_commit: upstreamCommit,
    workflow_commit: workflowCommit,
    tag_exists: false
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
    'scripts/tests/textpack-release.test.mjs',
    'scripts/textpack-artifacts.py',
    'scripts/tests/test_textpack_artifacts.py'
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
  const forkSource = process.env.FORK_SOURCE || ''
  if (operation === 'poll') {
    if (
      forkSource &&
      (process.env.PUBLISH !== 'false' || process.env.COMPLETE_EXISTING === 'true')
    ) {
      throw new Error('Build a new fork release as a draft before publishing')
    }
    if (Boolean(forkSource) !== Boolean(process.env.FORK_VERSION)) {
      throw new Error('Specify both a fork source commit and a fork version')
    }
    const release = forkSource
      ? await findForkRelease(
          requestGitHub,
          process.env.REQUESTED_TAG || '',
          process.env.FORK_VERSION
        )
      : await findRelease(
          requestGitHub,
          process.env.REQUESTED_TAG || '',
          process.env.COMPLETE_EXISTING === 'true'
        )
    writeOutputs(release)
    console.log(
      release.needed
        ? `Preparing ${release.tag} from upstream ${release.upstream_tag}`
        : `${release.tag} already exists; no build needed`
    )
  } else if (operation === 'prepare') {
    writeOutputs(forkSource ? prepareForkRelease(forkSource) : prepareRelease())
  } else {
    throw new Error('Expected poll or prepare')
  }
}
