import path from 'path'
import { readFile, stat } from 'fs/promises'
import { contentSha256 } from 'common/filesystem'
import { hasTextBundleExtension, hasTextPackExtension, isSamePathSync } from 'common/filesystem/paths'
import type { DiskBaseline, DocumentKind, LineEnding, MarkdownDocument, SaveIntent, SaveOptions } from '@shared/types/files'
import { loadCliMarkdownFile, loadMarkdownFile, writeMarkdownFile } from './markdown'
import {
  exportPackageToMarkdown,
  exportTextPackToMarkdown,
  getOpenTextPackDirectory,
  loadTextPackFile,
  prepareTextPackReload,
  writeTextPackFromDirectory,
  writeTextPackFile
} from './textpack'
import { createTextBundle, getBundleTextPath, loadTextBundle, saveTextBundle, withPreparedPackage } from './textbundle'

export const loadDocumentFile = async(
  pathname: string,
  preferredEol: LineEnding,
  autoGuessEncoding = true,
  trimTrailingNewline = 2,
  autoNormalizeLineEndings = false
): Promise<MarkdownDocument> => {
  if (hasTextBundleExtension(pathname)) {
    return loadTextBundle(pathname, preferredEol, trimTrailingNewline, autoNormalizeLineEndings)
  }
  if (hasTextPackExtension(pathname)) {
    return loadTextPackFile(
      pathname,
      preferredEol,
      autoGuessEncoding,
      trimTrailingNewline,
      autoNormalizeLineEndings
    )
  }
  const doc = await loadMarkdownFile(
    pathname,
    preferredEol,
    autoGuessEncoding,
    trimTrailingNewline,
    autoNormalizeLineEndings
  )
  return {
    ...doc,
    encoding: { encoding: doc.encoding.encoding, isBom: !!doc.encoding.isBom },
    documentKind: 'markdown',
    resourcePath: path.dirname(pathname)
  }
}

export const loadCliDocumentFile = async(
  ...args: Parameters<typeof loadCliMarkdownFile>
): Promise<MarkdownDocument> => {
  if (hasTextPackExtension(args[0]) || hasTextBundleExtension(args[0])) {
    const [pathname, , preferredEol, autoGuessEncoding, trimTrailingNewline, autoNormalizeLineEndings] = args
    return loadDocumentFile(pathname, preferredEol, autoGuessEncoding, trimTrailingNewline, autoNormalizeLineEndings)
  }
  const doc = await loadCliMarkdownFile(...args)
  return {
    ...doc,
    encoding: { encoding: doc.encoding.encoding, isBom: !!doc.encoding.isBom },
    documentKind: 'markdown',
    resourcePath: path.dirname(doc.pathname)
  }
}

export const inspectDocumentFile = async(
  pathname: string,
  preferredEol: LineEnding,
  autoGuessEncoding = true,
  trimTrailingNewline = 2,
  autoNormalizeLineEndings = false,
  prepareReload = false
): Promise<MarkdownDocument> => {
  if (hasTextPackExtension(pathname)) {
    if (prepareReload) {
      return prepareTextPackReload(
        pathname,
        preferredEol,
        trimTrailingNewline,
        autoNormalizeLineEndings
      )
    }
    return loadTextPackFile(
      pathname,
      preferredEol,
      autoGuessEncoding,
      trimTrailingNewline,
      autoNormalizeLineEndings,
      false
    )
  }
  return loadDocumentFile(
    pathname,
    preferredEol,
    autoGuessEncoding,
    trimTrailingNewline,
    autoNormalizeLineEndings
  )
}

export const writeDocumentFile = async(
  pathname: string,
  markdown: string,
  options: SaveOptions,
  sourcePath?: string,
  intent: SaveIntent = 'save',
  bundle: { stagedImages?: string; baseline?: DiskBaseline } = {}
): Promise<{
  documentKind: DocumentKind
  resourcePath: string
  markdown?: string
}> => {
  const sourceBundle = sourcePath && hasTextBundleExtension(sourcePath) ? sourcePath : undefined
  if (hasTextBundleExtension(pathname)) {
    if (sourceBundle && isSamePathSync(pathname, sourceBundle)) {
      return saveTextBundle(pathname, markdown, options, bundle.stagedImages, bundle.baseline)
    }
    return createTextBundle(pathname, {
      markdown, options, stagedImages: bundle.stagedImages,
      sourcePackage: await getPackageDirectory(sourcePath),
      sourceDirectory: sourcePath && path.dirname(sourcePath)
    })
  }
  if (sourceBundle) {
    return withPreparedPackage({
      markdown, options, sourcePackage: sourceBundle, stagedImages: bundle.stagedImages
    }, async(root, preparedMarkdown) => {
      if (hasTextPackExtension(pathname)) {
        await writeTextPackFromDirectory(root, pathname)
        const { resourcePath } = await loadTextPackFile(pathname, 'lf', false)
        if (!resourcePath) throw new Error('Unable to open the new TextPack for editing.')
        return { documentKind: 'textpack', resourcePath, markdown: preparedMarkdown }
      }
      return exportPackageToMarkdown(root, pathname, preparedMarkdown, options)
    })
  }
  if (hasTextPackExtension(pathname)) {
    return writeTextPackFile(pathname, markdown, options, sourcePath, undefined, intent)
  }
  if (sourcePath && hasTextPackExtension(sourcePath)) {
    return exportTextPackToMarkdown(sourcePath, pathname, markdown, options)
  }
  // The IPC `SaveOptions` has every field optional, but writeMarkdownFile
  // requires the strict `MarkdownDocumentOptions` shape — the renderer always
  // populates every field for the unsaved-file dialog payload, so the cast
  // is safe at this seam.
  await writeMarkdownFile(pathname, markdown, options as Parameters<typeof writeMarkdownFile>[2])
  return { documentKind: 'markdown', resourcePath: path.dirname(pathname) }
}

const getPackageDirectory = async(source?: string): Promise<string | undefined> => {
  if (source && hasTextBundleExtension(source)) return source
  if (source && hasTextPackExtension(source)) return getOpenTextPackDirectory(source)
}

export const exportDocumentTextPack = async(
  destination: string, markdown: string, options: SaveOptions, source?: string, stagedImages?: string
): Promise<void> => {
  await withPreparedPackage({
    markdown, options, sourcePackage: await getPackageDirectory(source),
    sourceDirectory: source && path.dirname(source), stagedImages
  }, root => writeTextPackFromDirectory(root, destination))
}

export const readDocumentBaseline = async(pathname: string): Promise<DiskBaseline> => {
  try {
    const textPath = hasTextBundleExtension(pathname) ? await getBundleTextPath(pathname) : pathname
    const bytes = await readFile(textPath)
    const info = await stat(textPath)
    return {
      exists: true,
      rawSha256: contentSha256(bytes),
      sizeBytes: bytes.byteLength,
      mtimeMs: info.mtimeMs
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false }
    throw error
  }
}
