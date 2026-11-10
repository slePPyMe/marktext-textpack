import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findRelease } from '../textpack-release.mjs'

const upstream = {
  tag_name: 'v0.23.0',
  draft: false,
  prerelease: false,
  published_at: '2026-10-21T05:02:06Z',
  html_url: 'https://github.com/marktext/marktext/releases/tag/v0.23.0'
}

test('new upstream stable release preserves its version and uses a fork tag', async () => {
  const calls = []
  const result = await findRelease(async (route, allowMissing) => {
    calls.push([route, allowMissing])
    return calls.length === 1 ? upstream : null
  })
  assert.equal(result.needed, true)
  assert.equal(result.version, '0.23.0')
  assert.equal(result.tag, 'textpack-v0.23.0')
  assert.equal(result.upstream_published_at, upstream.published_at)
  assert.deepEqual(calls, [
    ['marktext/marktext/releases/latest', undefined],
    ['slePPyMe/marktext-textpack/releases/tags/textpack-v0.23.0', true]
  ])
})

test('published releases and drafts are not rebuilt or overwritten', async () => {
  for (const existing of [{ draft: false }, { draft: true }]) {
    let count = 0
    const result = await findRelease(async () => {
      count += 1
      return count === 1 ? upstream : existing
    })
    assert.equal(result.needed, false)
  }
})

test('upstream drafts, prereleases and malformed tags cannot trigger publication', async () => {
  for (const change of [
    { draft: true },
    { prerelease: true },
    { tag_name: 'v0.24.0-rc.1' },
    { tag_name: 'v0.23.0\npublish=true' }
  ]) {
    await assert.rejects(
      findRelease(async () => ({ ...upstream, ...change })),
      /published upstream stable/
    )
  }
})

test('manual selection resolves an actual upstream release', async () => {
  const calls = []
  await findRelease(async (route) => {
    calls.push(route)
    return calls.length === 1 ? upstream : null
  }, 'v0.23.0')
  assert.equal(calls[0], 'marktext/marktext/releases/tags/v0.23.0')
})

test('API failures remain failures instead of being treated as a new release', async () => {
  await assert.rejects(
    findRelease(async () => {
      throw new Error('GitHub unavailable')
    }),
    /GitHub unavailable/
  )
})
