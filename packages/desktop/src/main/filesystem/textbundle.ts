import { constants } from 'fs'
import { cp, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { contentSha256 } from 'common/filesystem'
import { isBundleTextName } from 'common/filesystem/paths'
import type { DiskBaseline, LineEnding, MarkdownDocument, SaveOptions } from '@shared/types/files'
import { writeFileAtomicWithRetry } from '.'
import { encodeMarkdown, loadMarkdownFile, writeMarkdownFile } from './markdown'
import {
  initializePackageDirectory,
  packageLocalResources,
  rewriteDestinations,
  TEXTPACK_LIMITS,
  validatePackageMetadata
} from './textpack'

const lstatIfPresent = async(pathname: string) => {
  try {
    return await lstat(pathname)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export const getBundleTextPath = async(root: string): Promise<string> => {
  if (!(await lstat(root)).isDirectory()) throw new Error('A TextBundle must be a directory.')
  const entries = await readdir(root, { withFileTypes: true })
  const info = entries.find(entry => entry.name === 'info.json')
  if (!info?.isFile()) throw new Error('A TextBundle must contain info.json.')
  const metadata = path.join(root, info.name)
  if ((await lstat(metadata)).size > TEXTPACK_LIMITS.infoBytes) {
    throw new Error('TextBundle info.json is too large.')
  }
  const text = entries.filter(entry => isBundleTextName(entry.name))
  if (text.length !== 1 || !text[0].isFile()) {
    throw new Error('A TextBundle must contain exactly one text.* file at its root.')
  }
  const assets = entries.find(entry => entry.name.toLowerCase() === 'assets')
  if (assets && (assets.name !== 'assets' || !assets.isDirectory())) {
    throw new Error('TextBundle assets must be stored in a directory named assets.')
  }
  await validatePackageMetadata(metadata, 'TextBundle')
  const textPath = path.join(root, text[0].name)
  if ((await lstat(textPath)).size > TEXTPACK_LIMITS.textBytes) {
    throw new Error('TextBundle document text is too large.')
  }
  return textPath
}

export const loadTextBundle = async(
  pathname: string,
  preferredEol: LineEnding,
  trimTrailingNewline: number,
  autoNormalizeLineEndings: boolean
): Promise<MarkdownDocument> => {
  const root = path.resolve(pathname)
  const doc = await loadMarkdownFile(
    await getBundleTextPath(root), preferredEol, false, trimTrailingNewline, autoNormalizeLineEndings, true
  )
  return {
    ...doc,
    pathname: root,
    filename: path.basename(root),
    encoding: { encoding: 'utf8', isBom: !!doc.encoding.isBom },
    documentKind: 'textbundle',
    resourcePath: root
  }
}

const bundleSaveFormat = (options: SaveOptions) => ({
  adjustLineEndingOnSave: Boolean(options.adjustLineEndingOnSave),
  lineEnding: options.lineEnding === 'crlf' ? 'crlf' as const : 'lf' as const,
  encoding: { encoding: 'utf8', isBom: typeof options.encoding === 'object' && options.encoding.isBom }
})

const materializeImages = async(
  markdown: string,
  stagedDirectory: string | undefined,
  bundle: string,
  created: string[]
): Promise<string> => {
  if (!stagedDirectory) return markdown
  const assets = path.join(bundle, 'assets')
  const referenced = new Map<string, string>()
  return rewriteDestinations(markdown, async(value, destination) => {
    if (!destination.image || !/^file:/i.test(value)) return null
    let source: string
    try {
      source = fileURLToPath(value)
    } catch {
      return null
    }
    if (path.relative(stagedDirectory, path.dirname(source)) !== '') return null
    const existingPath = referenced.get(source)
    if (existingPath) return existingPath

    const sourceInfo = await lstat(source)
    if (!sourceInfo.isFile() || sourceInfo.size > TEXTPACK_LIMITS.entryBytes) {
      throw new Error('Invalid or oversized TextBundle image.')
    }
    const assetInfo = await lstatIfPresent(assets)
    if (!assetInfo) await mkdir(assets)
    else if (!assetInfo.isDirectory()) throw new Error('TextBundle assets must be a directory.')

    const ext = path.extname(source)
    const stem = path.basename(source, ext)
    for (let index = 1; ; ++index) {
      const name = index === 1 ? stem + ext : stem + '-' + index + ext
      const target = path.join(assets, name)
      const relative = 'assets/' + encodeURIComponent(name)
      try {
        await copyFile(source, target, constants.COPYFILE_EXCL)
        created.push(target)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        const targetInfo = await lstat(target)
        if (!targetInfo.isFile() || targetInfo.size !== sourceInfo.size ||
          !(await readFile(target)).equals(await readFile(source))) continue
      }
      referenced.set(source, relative)
      return relative
    }
  })
}

interface PackageContent {
  markdown: string
  options: SaveOptions
  sourceDirectory?: string
  sourcePackage?: string
  stagedImages?: string
}

const preparePackage = async(root: string, content: PackageContent): Promise<string> => {
  const { sourcePackage, sourceDirectory, stagedImages, options } = content
  let textPath: string
  let markdown = content.markdown
  if (sourcePackage) {
    const sourceText = await getBundleTextPath(sourcePackage)
    await cp(sourcePackage, root, {
      recursive: true,
      filter: async pathname => {
        const info = await lstat(pathname)
        if (!info.isFile() && !info.isDirectory()) {
          throw new Error('Cannot copy a link or special file in a TextBundle: ' + pathname)
        }
        return true
      }
    })
    textPath = path.join(root, path.basename(sourceText))
    markdown = await materializeImages(markdown, stagedImages, root, [])
  } else {
    await initializePackageDirectory(root)
    textPath = path.join(root, 'text.md')
    markdown = await packageLocalResources(markdown, sourceDirectory, root)
  }
  await mkdir(path.join(root, 'assets'), { recursive: true })
  await writeMarkdownFile(textPath, markdown, bundleSaveFormat(options))
  return markdown
}

export const withPreparedPackage = async<T>(
  content: PackageContent,
  use: (root: string, markdown: string) => Promise<T>
): Promise<T> => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'marktext-bundle-'))
  try {
    return await use(scratch, await preparePackage(scratch, content))
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

export const createTextBundle = async(target: string, content: PackageContent) => {
  const exists = () => lstatIfPresent(target)
  if (await exists()) throw new Error('That TextBundle destination already exists. Choose a new name.')
  const scratch = await mkdtemp(path.join(path.dirname(target), '.marktext-bundle-'))
  try {
    const markdown = await preparePackage(scratch, content)
    const textPath = await getBundleTextPath(scratch)
    const bytes = await readFile(textPath)
    const rawBaseline = {
      exists: true as const,
      rawSha256: contentSha256(bytes),
      sizeBytes: bytes.byteLength,
      mtimeMs: (await lstat(textPath)).mtimeMs
    }
    if (await exists()) throw new Error('The TextBundle destination changed while saving.')
    await rename(scratch, target)
    return { documentKind: 'textbundle' as const, resourcePath: target, markdown, rawBaseline }
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

export const saveTextBundle = async(
  root: string, markdown: string, options: SaveOptions, stagedImages?: string, expected?: DiskBaseline
) => {
  const textPath = await getBundleTextPath(root)
  const original = await readFile(textPath)
  if (expected && (!expected.exists || contentSha256(original) !== expected.rawSha256)) {
    throw new Error('The TextBundle changed while saving. Reload it or choose Save As.')
  }
  const created: string[] = []
  let encoded: Buffer
  try {
    markdown = await materializeImages(markdown, stagedImages, root, created)
    if (textPath !== await getBundleTextPath(root) || !(await readFile(textPath)).equals(original)) {
      throw new Error('The TextBundle changed while saving. Reload it or choose Save As.')
    }
    encoded = encodeMarkdown(markdown, bundleSaveFormat(options))
    if (!encoded.equals(original)) await writeFileAtomicWithRetry(textPath, encoded, 'utf8')
  } catch (error) {
    await Promise.allSettled(created.map(pathname => rm(pathname, { force: true })))
    throw error
  }
  return {
    documentKind: 'textbundle' as const,
    resourcePath: root,
    markdown,
    rawBaseline: {
      exists: true as const,
      rawSha256: contentSha256(encoded),
      sizeBytes: encoded.byteLength,
      mtimeMs: (await lstat(textPath)).mtimeMs
    }
  }
}
