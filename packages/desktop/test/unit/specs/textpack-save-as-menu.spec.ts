// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionHost } from '../../../src/main/applicationState/sessionHost'
import type { CheckpointService } from '../../../src/main/applicationState/checkpointService'
import type EditorWindow from '../../../src/main/windows/editor'
import type { DocumentSnapshot, PersistResult, PreparedSessionWindow, WindowCheckpointRequest } from '@shared/types/applicationState'
import { closeTextPackSession, loadTextPackFile, writeTextPackFile, prepareTextPackReload } from '../../../src/main/filesystem/textpack'
import { documentWrites } from '../../../src/main/filesystem/documentWrites'
import { contentSha256 } from 'common/filesystem'

const mocks = vi.hoisted(() => ({
  directory: '',
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  win: { id: 17, isDestroyed: () => false, webContents: { id: 17, send: vi.fn(), once: vi.fn() } },
  showSaveDialog: vi.fn(), showMessageBox: vi.fn()
}))
vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), emit: vi.fn(), handle: (name: string, fn: (...args: unknown[]) => unknown) => mocks.handlers.set(name, fn) },
  app: { getPath: () => mocks.directory, on: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: { showSaveDialog: mocks.showSaveDialog, showMessageBox: mocks.showMessageBox },
  screen: {}
}))
vi.mock('electron-log', () => ({ default: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('ced', () => ({ default: () => 'utf8' }))
vi.mock('../../../src/main/i18n', () => ({ t: (key: string) => key }))

describe('TextPack native session Save As', () => {
  let original: string
  let destination: string
  let host: SessionHost
  let prepared: PreparedSessionWindow
  let service: CheckpointService
  let contextToken: string
  let sequence: number
  const current = () => service.getDocument(prepared.snapshot.documents[0].id)
  const checkpoint = async(markdown: string) => {
    const document = current()
    const request: WindowCheckpointRequest = {
      contextToken, sequence: ++sequence, closeTransactionId: null,
      layout: prepared.snapshot.layout, projectView: prepared.snapshot.projectView,
      documents: [{ id: document.id, content: { kind: 'recovery', contentRevision: sequence }, readOnly: document.readOnly, saveFormat: document.saveFormat, view: null }],
      activeDocumentId: document.id,
      dirtyContents: [{ documentId: document.id, contentRevision: sequence, markdown }]
    }
    expect(await service.checkpoint(prepared.snapshot.id, request)).toMatchObject({ status: 'persisted' })
  }
  const save = (saveAs = true) => host.saveDocument(prepared.snapshot.id, current().id, saveAs)
  beforeEach(async() => {
    vi.clearAllMocks()
    documentWrites.clearOwner(17)
    mocks.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-session-pack-'))
    original = path.join(mocks.directory, 'original.textpack')
    destination = original
    await writeTextPackFile(original, '# Original', {})
    await closeTextPackSession(original)
    const preferences = {
      getPreferredEol: () => 'lf',
      getAll: () => ({ defaultEncoding: 'utf8', autoGuessEncoding: true, trimTrailingNewline: 2,
        autoNormalizeLineEndings: false, defaultOpenMode: 'edit', startUpAction: 'restoreAll',
        restoreLayoutState: true, restoreEditors: true, restoreViewState: true,
        tocPosition: 'left', sourceCodeModeEnabled: false })
    }
    host = new SessionHost({ preferences, menu: { addRecentlyUsedDocument: vi.fn(), relocateRecentlyUsedDocuments: vi.fn() }, windowManager: {} } as unknown as ConstructorParameters<typeof SessionHost>[0])
    await host.start([{ path: original, isDir: false }], value => { prepared = value })
    host.registerEditor({ sessionStateId: prepared.snapshot.id, browserWindow: mocks.win, addToOpenedFiles: vi.fn(), removeFromOpenedFiles: vi.fn(), changeOpenedFilePath: vi.fn() } as unknown as EditorWindow)
    service = (host as unknown as { _service: CheckpointService })._service
    contextToken = (await service.initializeRenderer(prepared.snapshot.id)).context.contextToken
    sequence = 0
    await checkpoint('# Current edit')
  })
  afterEach(async() => {
    await closeTextPackSession(original)
    if (destination !== original) await closeTextPackSession(destination)
    await fs.rm(mocks.directory, { recursive: true, force: true })
  })
  it('registers the archive baseline and private resource directory', async() => {
    const initial = prepared.snapshot.documents[0]
    expect(initial).toMatchObject({ documentKind: 'textpack', resourcePath: expect.any(String), content: { kind: 'disk', baseline: { rawSha256: contentSha256(await fs.readFile(original)) } } })
    expect(initial.resourcePath).not.toBe(path.dirname(original))
  })
  it.each(['same', 'different'])('recreates a deleted file through Save As at a %s path', async(target) => {
    await fs.unlink(original)
    if (target === 'different') destination = path.join(mocks.directory, 'recovered.textpack')
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: destination })
    expect(await save()).toMatchObject({ status: 'saved', document: { documentKind: 'textpack', resourcePath: expect.any(String) } })
    await closeTextPackSession(destination)
    expect((await loadTextPackFile(destination, 'lf')).markdown).toContain('# Current edit')
  })
  it('keeps ordinary Save strict after deletion', async() => {
    await fs.unlink(original)
    expect(await save(false)).toEqual({ status: 'failed' })
    expect(mocks.win.webContents.send).toHaveBeenCalledWith('mt::tab-save-failure', current().id, expect.stringMatching(/no longer exists.*Save As/))
    await expect(fs.access(original)).rejects.toThrow()
  })
  it('offers both formats and preserves disk content when canceled', async() => {
    const before = await fs.readFile(original)
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    expect(await save()).toEqual({ status: 'canceled' })
    expect(mocks.showSaveDialog).toHaveBeenCalledWith(mocks.win, expect.objectContaining({ properties: ['showOverwriteConfirmation'], filters: expect.arrayContaining([expect.objectContaining({ extensions: ['textpack'] })]) }))
    expect(await fs.readFile(original)).toEqual(before)
  })
  it('allows explicit Save As to replace an externally changed archive', async() => {
    await fs.writeFile(original, 'external replacement')
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: original })
    expect(await save()).toMatchObject({ status: 'saved' })
    await closeTextPackSession(original)
    expect((await loadTextPackFile(original, 'lf')).markdown).toContain('# Current edit')
  })
  it.each([false, true])('blocks a native %s Save As write when read-only', async(saveAs) => {
    const before = await fs.readFile(original)
    await documentWrites.setReadOnly(17, current().id, true)
    expect(await save(saveAs)).toEqual({ status: 'failed' })
    expect(await fs.readFile(original)).toEqual(before)
    expect(mocks.showSaveDialog).not.toHaveBeenCalled()
  })
  it('cancels a Save As opened before the tab became read-only', async() => {
    const before = await fs.readFile(original)
    mocks.showSaveDialog.mockImplementationOnce(async() => {
      await documentWrites.setReadOnly(17, current().id, true)
      return { canceled: false, filePath: original }
    })
    expect(await save()).toEqual({ status: 'failed' })
    expect(await fs.readFile(original)).toEqual(before)
  })
  it('preserves edits arriving while a native save dialog is open', async() => {
    mocks.showSaveDialog.mockImplementationOnce(async() => {
      await checkpoint('# Newer edit')
      return { canceled: false, filePath: original }
    })
    expect(await save()).toMatchObject({ status: 'saved', savedMarkdown: '# Current edit', document: { content: { kind: 'recovery' } } })
    expect(service.getDocument(current().id).content.kind).toBe('recovery')
    const initialized = await service.initializeRenderer(prepared.snapshot.id)
    expect(initialized.documentContents[0].markdown).toBe('# Newer edit')
  })
  it('commits converted first-save text as the native clean baseline', async() => {
    const source = '![image](data:image/png;base64,aGVsbG8=)'
    const draft = await host.newDocument(prepared.snapshot.id, '', source)
    destination = path.join(mocks.directory, 'converted.textpack')
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: destination })
    const result = await host.saveDocument(prepared.snapshot.id, draft.id, true)
    expect(result).toMatchObject({ status: 'saved', sourceMarkdown: source, document: { content: { kind: 'disk' } } })
    if (result.status !== 'saved') throw new Error('Expected the converted save')
    expect(result.savedMarkdown).toMatch(/!\[image\]\(assets\//)
    const initialized = await service.initializeRenderer(prepared.snapshot.id)
    expect(initialized.documentContents.find(body => body.documentId === draft.id)?.markdown).toBe(result.savedMarkdown)
  })
  it('updates durable resource ownership only after a staged reload is accepted', async() => {
    const previous = current().resourcePath
    destination = path.join(mocks.directory, 'external.textpack')
    await writeTextPackFile(destination, '# External', {})
    await closeTextPackSession(destination)
    await fs.copyFile(destination, original)
    const data = await prepareTextPackReload(original, 'lf')
    await host.observeFile(prepared.snapshot.id, { type: 'change', change: { pathname: original, data } })
    expect(current().resourcePath).toBe(previous)
    const resolve = mocks.handlers.get('mt::resolve-textpack-reload')
    if (!resolve) throw new Error('Expected native reload handler')
    expect(await resolve({ sender: mocks.win.webContents }, original, data.reloadToken, true)).toMatchObject({ accepted: true })
    expect(current().resourcePath).toBe(data.resourcePath)
    expect(current().resourcePath).not.toBe(previous)
  })

  it('acknowledges a durable close even if temporary workspace cleanup fails', async() => {
    const document = current()
    if (!document.resourcePath) throw new Error('Expected a TextPack workspace')
    const workspaceDirectory = path.dirname(document.resourcePath)
    const remove = fs.rm.bind(fs)
    const cleanup = vi.spyOn(fs, 'rm').mockImplementation(async(pathname, options) => {
      if (String(pathname) === workspaceDirectory) throw new Error('Workspace is locked')
      await remove(pathname, options)
    })
    try {
      const native = host as unknown as {
        _endDocuments(windowId: string, documents: DocumentSnapshot[], discard: boolean): Promise<PersistResult>
      }
      expect(await native._endDocuments(prepared.snapshot.id, [document], true)).toMatchObject({ status: 'persisted' })
      expect(service.getWindow(prepared.snapshot.id)?.documents).toEqual([])
      expect(mocks.win.webContents.send).toHaveBeenCalledWith('mt::state::documents-ended', [document.id])
    } finally {
      cleanup.mockRestore()
      await fs.rm(workspaceDirectory, { recursive: true, force: true })
    }
  })

})
