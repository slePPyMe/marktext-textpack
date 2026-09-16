import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcMain, type IpcMainEvent } from 'electron'

const mocks = vi.hoisted(() => ({
  win: { id: 17, webContents: { send: vi.fn() } },
  openPath: vi.fn(),
  openExternal: vi.fn(),
  showMessageBox: vi.fn()
}))

vi.mock('electron', async() => {
  const { EventEmitter } = await import('node:events')
  return {
    ipcMain: new EventEmitter(),
    BrowserWindow: { fromWebContents: () => mocks.win },
    app: {},
    dialog: { showMessageBox: mocks.showMessageBox },
    shell: { openPath: mocks.openPath, openExternal: mocks.openExternal }
  }
})
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))
vi.mock('main_renderer/menu/actions/marktext', () => ({
  checkUpdates: vi.fn(),
  userSetting: vi.fn()
}))
vi.mock('main_renderer/menu/actions/view', () => ({ showTabBar: vi.fn() }))
vi.mock('main_renderer/commands', () => ({ COMMANDS: {} }))
vi.mock('main_renderer/filesystem/document', () => ({ writeDocumentFile: vi.fn() }))
vi.mock('main_renderer/filesystem/textpack', () => ({ moveTextPackSession: vi.fn() }))
vi.mock('main_renderer/utils', () => ({
  getPath: vi.fn(),
  getRecommendTitleFromMarkdownString: vi.fn()
}))
vi.mock('main_renderer/utils/pandoc', () => ({ default: vi.fn() }))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

import 'main_renderer/menu/actions/file'

// Exercise the actual IPC handler, path resolver and document classifier together.
// This guards both sides of the upstream anchor-link / TextPack rebase conflict.
describe('file menu document links after upstream sync', () => {
  let dir: string
  const event = { sender: mocks.win.webContents } as unknown as IpcMainEvent

  const clickLink = async(href: string): Promise<void> => {
    const handler = ipcMain.listeners('mt::format-link-click')[0]
    if (!handler) throw new Error('The file menu link handler was not registered')
    await handler(event, { data: { href }, dirname: dir })
  }

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-file-menu-links-'))
    for (const name of ['notes.md', 'notes.textpack', 'my notes.textpack', 'C#.textpack', 'literal%23.textpack', 'run.cmd']) {
      fs.writeFileSync(path.join(dir, name), '')
    }
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['notes.md#intro', 'notes.md', 'intro'],
    ['notes.textpack#intro', 'notes.textpack', 'intro'],
    ['notes.textpack', 'notes.textpack', ''],
    ['my%20notes.textpack#%E4%B8%AD%E6%96%87', 'my notes.textpack', '%E4%B8%AD%E6%96%87'],
    ['C#.textpack', 'C#.textpack', ''],
    ['literal%2523.textpack#intro', 'literal%23.textpack', 'intro']
  ])('opens %s inside the editor with its anchor', async(href, filename, anchor) => {
    const emit = vi.spyOn(ipcMain, 'emit')

    await clickLink(href)

    expect(emit).toHaveBeenCalledWith('app-open-file-by-id', mocks.win.id, path.join(dir, filename), { anchor })
    expect(mocks.openPath).not.toHaveBeenCalled()
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('keeps remote links external', async() => {
    await clickLink('https://example.com/notes.textpack#intro')

    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com/notes.textpack#intro')
    expect(mocks.openPath).not.toHaveBeenCalled()
  })

  it('does not open an executable when its warning is declined', async() => {
    mocks.showMessageBox.mockResolvedValueOnce({ response: 0 })

    await clickLink('run.cmd')

    expect(mocks.showMessageBox).toHaveBeenCalled()
    expect(mocks.openPath).not.toHaveBeenCalled()
  })
})
