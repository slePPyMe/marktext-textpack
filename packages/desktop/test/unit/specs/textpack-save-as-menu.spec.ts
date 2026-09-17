import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcMain, type IpcMainEvent } from 'electron'
import { closeTextPackSession, loadTextPackFile, writeTextPackFile } from 'main_renderer/filesystem/textpack'

const mocks = vi.hoisted(() => ({
  win: { id: 17, webContents: { send: vi.fn() } },
  showSaveDialog: vi.fn(),
  showMessageBox: vi.fn()
}))

vi.mock('electron', async() => {
  const { EventEmitter } = await import('node:events')
  return {
    ipcMain: new EventEmitter(),
    BrowserWindow: { fromWebContents: () => mocks.win },
    app: {},
    dialog: { showSaveDialog: mocks.showSaveDialog, showMessageBox: mocks.showMessageBox },
    shell: {}
  }
})
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))
vi.mock('ced', () => ({ default: () => 'utf8' }))
vi.mock('main_renderer/menu/actions/marktext', () => ({ checkUpdates: vi.fn(), userSetting: vi.fn() }))
vi.mock('main_renderer/menu/actions/view', () => ({ showTabBar: vi.fn() }))
vi.mock('main_renderer/commands', () => ({ COMMANDS: {} }))
vi.mock('main_renderer/utils', () => ({
  getPath: () => os.tmpdir(),
  getRecommendTitleFromMarkdownString: () => 'Recovered'
}))
vi.mock('main_renderer/utils/pandoc', () => ({ default: vi.fn() }))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

import 'main_renderer/menu/actions/file'

describe('TextPack Save As command', () => {
  let directory: string
  let original: string
  let destination: string
  const event = { sender: mocks.win.webContents } as unknown as IpcMainEvent

  const runCommand = async(command: string): Promise<void> => {
    const handler = ipcMain.listeners(command)[0]
    if (!handler) throw new Error(`Missing handler for ${command}`)
    await handler(event, 'tab-1', 'original.textpack', original, '# Current edit', {})
  }

  beforeEach(async() => {
    vi.clearAllMocks()
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-save-as-command-'))
    original = path.join(directory, 'original.textpack')
    destination = original
    await writeTextPackFile(original, '# Original', {})
  })

  afterEach(async() => {
    await closeTextPackSession(original)
    if (destination !== original) await closeTextPackSession(destination)
    await fs.rm(directory, { recursive: true, force: true })
  })

  it.each(['same', 'different'])('recreates a deleted file through Save As at a %s path', async(target) => {
    await fs.unlink(original)
    if (target === 'different') destination = path.join(directory, 'recovered.textpack')
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: destination })

    await runCommand('mt::response-file-save-as')

    // Release the session, then actually reopen the written archive from disk.
    await closeTextPackSession(destination)
    const reopened = await loadTextPackFile(destination, 'lf')
    expect(reopened.markdown).toContain('# Current edit')
    expect(mocks.win.webContents.send).not.toHaveBeenCalledWith('mt::tab-save-failure', expect.anything(), expect.anything())
    if (target === 'same') {
      expect(mocks.win.webContents.send).toHaveBeenCalledWith('mt::tab-saved', 'tab-1')
    } else {
      expect(mocks.win.webContents.send).toHaveBeenCalledWith('mt::set-pathname', expect.objectContaining({ pathname: destination }))
    }
  })

  it('keeps ordinary Save strict after the original is deleted', async() => {
    await fs.unlink(original)

    await runCommand('mt::response-file-save')

    expect(mocks.showSaveDialog).not.toHaveBeenCalled()
    expect(mocks.win.webContents.send).toHaveBeenCalledWith('mt::tab-save-failure', 'tab-1', expect.stringMatching(/no longer exists.*Save As/))
    await expect(fs.access(original)).rejects.toThrow()
  })

  it('requests native overwrite confirmation and does not write when the dialog is cancelled', async() => {
    const before = await fs.readFile(original)
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: original })

    await runCommand('mt::response-file-save-as')

    expect(mocks.showSaveDialog).toHaveBeenCalledWith(mocks.win, expect.objectContaining({ properties: ['showOverwriteConfirmation'] }))
    expect(await fs.readFile(original)).toEqual(before)
    expect(mocks.win.webContents.send).not.toHaveBeenCalled()
  })

  it('replaces an existing target after the native dialog confirms the selection', async() => {
    await fs.writeFile(original, 'external replacement')
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: original })

    await runCommand('mt::response-file-save-as')

    await closeTextPackSession(original)
    expect((await loadTextPackFile(original, 'lf')).markdown).toContain('# Current edit')
    expect(mocks.win.webContents.send).toHaveBeenCalledWith('mt::tab-saved', 'tab-1')
  })
})
