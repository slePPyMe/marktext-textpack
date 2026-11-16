import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  exportDocumentTextPack, loadDocumentFile, readDocumentBaseline, writeDocumentFile
} from '../../../src/main/filesystem/document'
import { normalizeDocumentPath } from '../../../src/main/filesystem'
import { closeTextPackSession, getOpenTextPackDirectory } from '../../../src/main/filesystem/textpack'

vi.mock('ced', () => ({ default: () => 'utf8' }))

const directories: string[] = []
const packs: string[] = []
const temp = async(): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'marktext-bundle-test-'))
  directories.push(root)
  return root
}

afterEach(async() => {
  await Promise.all(packs.splice(0).map(closeTextPackSession))
  await Promise.all(directories.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('creates a directory document and resolves its body path to the same document', async() => {
  const root = await temp()
  const bundle = path.join(root, 'First note.textbundle')
  const data = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71]).toString('base64')

  const saved = await writeDocumentFile(bundle, '![new](' + data + ')\n\n![remote](https://example.invalid/p.png)', {})
  expect(saved.documentKind).toBe('textbundle')
  expect(saved.markdown).toMatch(/!\[new\]\(assets\/[^)]+\.png\)/)
  expect(saved.markdown).toContain('https://example.invalid/p.png')
  expect(await readdir(path.join(bundle, 'assets'))).toHaveLength(1)
  expect(normalizeDocumentPath(bundle)).toEqual({ path: bundle, isDir: false })
  expect(normalizeDocumentPath(path.join(bundle, 'text.md'))).toEqual({ path: bundle, isDir: false })
  expect(await loadDocumentFile(bundle, 'lf')).toMatchObject({
    pathname: bundle,
    resourcePath: bundle,
    documentKind: 'textbundle',
    markdown: saved.markdown
  })
  await expect(writeDocumentFile(bundle, 'other note', {}, undefined, 'saveAs')).rejects.toThrow(/already exists/)
  expect(await readFile(path.join(bundle, 'text.md'), 'utf8')).toBe(saved.markdown)
})

it('preserves metadata, unused attachments and member paths across both Save As directions', async() => {
  const root = await temp()
  const original = path.join(root, 'Source.textbundle')
  const pack = path.join(root, 'Shared.textpack')
  const restored = path.join(root, 'Restored.textbundle')
  await mkdir(path.join(original, 'assets', 'empty'), { recursive: true })
  const metadata = '{ "version": 2, "custom.app": { "color": "blue" } }\n'
  await writeFile(path.join(original, 'info.json'), metadata)
  await writeFile(path.join(original, 'text.markdown'), '# Original')
  await writeFile(path.join(original, 'assets', 'keep.bin'), Buffer.from([0, 42, 255]))
  await writeFile(path.join(original, 'extra.txt'), 'extra')
  await writeFile(path.join(original, 'assets', 'note.png'), 'image bytes')

  const markdown = '# New copy\n\n![image](assets/note.png)'
  await writeDocumentFile(pack, markdown, {}, original, 'saveAs')
  packs.push(pack)
  const packed = await readFile(pack)
  await writeDocumentFile(restored, markdown, {}, pack, 'saveAs')
  expect(await readFile(path.join(restored, 'text.markdown'), 'utf8')).toBe(markdown)
  expect(await readFile(path.join(restored, 'info.json'), 'utf8')).toBe(metadata)
  expect(await readFile(path.join(restored, 'extra.txt'), 'utf8')).toBe('extra')
  expect(await readFile(path.join(restored, 'assets', 'keep.bin'))).toEqual(Buffer.from([0, 42, 255]))
  expect(await readdir(path.join(restored, 'assets', 'empty'))).toEqual([])
  expect(await readFile(pack)).toEqual(packed)
  expect(await readFile(path.join(original, 'text.markdown'), 'utf8')).toBe('# Original')
})

it('exports pending images as a snapshot and protects newer external changes on save', async() => {
  const root = await temp()
  const bundle = path.join(root, 'Draft.textbundle')
  const pack = path.join(root, 'Copy.textpack')
  const staging = path.join(root, 'Staged # files')
  await writeDocumentFile(bundle, '# Before', {})
  await mkdir(staging)
  const picture = path.join(staging, 'sample.png')
  await writeFile(picture, 'pending image')
  const markdown = '# Draft\n\n![picture](' + pathToFileURL(picture).href + ')'
  const baseline = await readDocumentBaseline(bundle)

  await exportDocumentTextPack(pack, markdown, {}, bundle, staging)
  const exported = await loadDocumentFile(pack, 'lf')
  packs.push(pack)
  expect(exported.markdown).toBe('# Draft\n\n![picture](assets/sample.png)')
  expect(await readFile(path.join(await getOpenTextPackDirectory(pack), 'assets', 'sample.png'), 'utf8')).toBe('pending image')
  expect(await readFile(path.join(bundle, 'text.md'), 'utf8')).toBe('# Before')
  expect(await readdir(path.join(bundle, 'assets'))).toEqual([])

  await writeFile(path.join(bundle, 'text.md'), '# Changed externally')
  const save = (base: typeof baseline) =>
    writeDocumentFile(bundle, markdown, {}, bundle, 'save', { stagedImages: staging, baseline: base })
  await expect(save(baseline)).rejects.toThrow(/changed while saving/)
  expect(await readFile(path.join(bundle, 'text.md'), 'utf8')).toBe('# Changed externally')
  expect(await readdir(path.join(bundle, 'assets'))).toEqual([])

  const result = await save(await readDocumentBaseline(bundle))
  expect(result.markdown).toBe(exported.markdown)
  expect(await readFile(path.join(bundle, 'assets', 'sample.png'), 'utf8')).toBe('pending image')
  const body = path.join(bundle, 'text.md')
  await utimes(body, 10_000, 10_000)
  const savedTime = (await stat(body)).mtimeMs
  await writeDocumentFile(bundle, exported.markdown, {}, bundle)
  expect((await stat(body)).mtimeMs).toBe(savedTime)
})
