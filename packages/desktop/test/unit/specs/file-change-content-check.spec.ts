import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; dirname: (p: string) => string }
      fileUtils?: { isSamePathSync: (a: string, b: string) => boolean }
      electron?: { ipcRenderer: { send: (...a: unknown[]) => void; on: Mock; invoke: Mock } }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.fileUtils ??= { isSamePathSync: (a, b) => a === b }
  w.window.electron ??= { ipcRenderer: { send: () => {}, on: vi.fn(), invoke: vi.fn() } }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))
vi.mock('@/store/bufferedState', () => ({ debouncedSendBufferedState: vi.fn() }))

import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'

describe('useEditorStore LISTEN_FOR_FILE_CHANGE — a file changed on disk', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window.electron.ipcRenderer.on as Mock).mockReset()
  })

  afterEach(() => vi.restoreAllMocks())

  const makeTab = (store: ReturnType<typeof useEditorStore>, isSaved = true) => {
    const tab = {
      id: 'tab-1',
      filename: 'a.md',
      pathname: '/x/a.md',
      markdown: 'hello',
      isSaved,
      scrollTop: 120,
      notifications: [],
      history: { stack: [], index: -1 }
    }
    store.tabs = [tab] as unknown as typeof store.tabs
    store.tabIdToIndex = { 'tab-1': 0 }
    return tab
  }

  const captureHandler = () => {
    const onMock = window.electron.ipcRenderer.on as Mock
    const call = onMock.mock.calls.find((c) => c[0] === 'mt::update-file')!
    return call[1] as (e: unknown, payload: unknown) => void
  }

  const fire = (handler: ReturnType<typeof captureHandler>, markdown: string) =>
    handler(null, {
      type: 'change',
      change: {
        pathname: '/x/a.md',
        data: {
          markdown,
          filename: 'a.md',
          encoding: 'utf8',
          lineEnding: 'lf',
          adjustLineEndingOnSave: false,
          trimTrailingNewline: 2,
          isMixedLineEndings: false
        }
      }
    })

  // #1861: a watcher 'change' event fires even when only the file's mtime
  // changed (e.g. a git checkout that left the content byte-identical).
  it('ignores a change whose content matches the tab', () => {
    const store = useEditorStore()
    const tab = makeTab(store)
    const notifySpy = vi.spyOn(store, 'pushTabNotification').mockImplementation(() => {})
    store.LISTEN_FOR_FILE_CHANGE()

    fire(captureHandler(), 'hello')

    expect(notifySpy).not.toHaveBeenCalled()
    expect(tab.isSaved).toBe(true)
  })

  // #3652: MarkText as a preview window beside another editor. Reloading a tab
  // the user never touched discards nothing, so it must not depend on autoSave,
  // which writes in the opposite direction and would overwrite the other editor.
  it('reloads a tab without unsaved edits silently, with autoSave off', () => {
    const store = useEditorStore()
    usePreferencesStore().autoSave = false
    const tab = makeTab(store)
    const notifySpy = vi.spyOn(store, 'pushTabNotification').mockImplementation(() => {})
    store.LISTEN_FOR_FILE_CHANGE()

    fire(captureHandler(), 'hello world')

    expect(tab.markdown).toBe('hello world')
    expect(tab.isSaved).toBe(true)
    expect(notifySpy).not.toHaveBeenCalled()
  })

  it('asks first when the tab has unsaved edits', () => {
    const store = useEditorStore()
    const tab = makeTab(store, false)
    const notifySpy = vi.spyOn(store, 'pushTabNotification').mockImplementation(() => {})
    store.LISTEN_FOR_FILE_CHANGE()

    fire(captureHandler(), 'hello world')

    expect(tab.markdown).toBe('hello')
    expect(notifySpy).toHaveBeenCalledTimes(1)
  })

  it('still asks when the tab has unsaved edits and autoSave is on', () => {
    const store = useEditorStore()
    usePreferencesStore().autoSave = true
    const tab = makeTab(store, false)
    const notifySpy = vi.spyOn(store, 'pushTabNotification').mockImplementation(() => {})
    store.LISTEN_FOR_FILE_CHANGE()

    fire(captureHandler(), 'hello world')

    expect(tab.markdown).toBe('hello')
    expect(notifySpy).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])(
    'switches TextPack resources even when the text is unchanged (autoSave=%s)',
    async(autoSave) => {
      const store = useEditorStore()
      usePreferencesStore().autoSave = autoSave
      const tab = makeTab(store)
      Object.assign(tab, { documentKind: 'textpack', resourcePath: '/old/assets' })
      const invoke = vi.spyOn(window.electron.ipcRenderer, 'invoke').mockResolvedValue({
        accepted: true,
        resourcePath: '/new/assets'
      })
      const notify = vi.spyOn(store, 'pushTabNotification').mockImplementation(() => {})
      store.LISTEN_FOR_FILE_CHANGE()

      captureHandler()(null, {
        type: 'change',
        change: {
          pathname: tab.pathname,
          data: {
            markdown: 'hello',
            filename: tab.filename,
            encoding: 'utf8',
            lineEnding: 'lf',
            documentKind: 'textpack',
            reloadToken: 'external-edit'
          }
        }
      })
      await vi.waitFor(() => expect(store.tabs[0].resourcePath).toBe('/new/assets'))

      expect(invoke).toHaveBeenCalledWith(
        'mt::resolve-textpack-reload',
        tab.pathname,
        'external-edit',
        true
      )
      expect(store.tabs[0].markdown).toBe('hello')
      expect(store.tabs[0].isSaved).toBe(true)
      expect(notify).not.toHaveBeenCalled()
    }
  )

  it('keeps dirty TextPack content and resources when the external reload is declined', async() => {
    const store = useEditorStore()
    const tab = makeTab(store, false)
    Object.assign(tab, { documentKind: 'textpack', resourcePath: '/old/assets' })
    const invoke = vi
      .spyOn(window.electron.ipcRenderer, 'invoke')
      .mockResolvedValue({ accepted: false })
    const notify = vi.spyOn(store, 'pushTabNotification').mockImplementation(() => {})
    store.LISTEN_FOR_FILE_CHANGE()

    captureHandler()(null, {
      type: 'change',
      change: {
        pathname: tab.pathname,
        data: {
          markdown: 'external',
          documentKind: 'textpack',
          reloadToken: 'external-edit'
        }
      }
    })
    expect(invoke).not.toHaveBeenCalled()
    notify.mock.calls[0][0].action?.(false)
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        'mt::resolve-textpack-reload',
        tab.pathname,
        'external-edit',
        false
      )
    )
    expect(store.tabs[0].markdown).toBe('hello')
    expect(store.tabs[0].resourcePath).toBe('/old/assets')
    expect(store.tabs[0].isSaved).toBe(false)
  })
})
