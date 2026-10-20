import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  Object.assign(window, {
    path: { sep: '/', dirname: (p: string) => p.substring(0, p.lastIndexOf('/')) },
    fileUtils: { isSamePathSync: (a: string, b: string) => a === b },
    electron: {
      clipboard: { writeText: vi.fn() },
      ipcRenderer: { send: vi.fn(), on: vi.fn(), invoke: vi.fn() }
    }
  })
})

vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))
vi.mock('@/store/bufferedState', () => ({ debouncedSendBufferedState: vi.fn() }))

import { useEditorStore } from '@/store/editor'
import { createDocumentState } from '@/store/help'
import bus from '@/bus'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

function setup(markdown = 'snapshot') {
  const store = useEditorStore()
  const tab = createDocumentState({
    id: 'tab-1',
    pathname: '/notes/original.textpack',
    filename: 'original.textpack',
    documentKind: 'textpack',
    resourcePath: '/private/session',
    markdown,
    isSaved: false
  })
  store.tabs = [tab]
  store.currentFile = tab
  store.updateTabIdToIndex()
  store.LISTEN_FOR_SET_PATHNAME()
  const subscription = vi.mocked(window.electron.ipcRenderer.on).mock.calls.find(
    ([channel]) => channel === 'mt::set-pathname'
  )
  if (!subscription) throw new Error('Missing pathname listener')
  const handler = subscription[1] as (event: unknown, payload: Record<string, unknown>) => void
  return { tab, handler }
}

describe('TextPack save acknowledgements and rename', () => {
  it('accepts converted Markdown only when the saved snapshot still matches', () => {
    const { tab, handler } = setup()
    handler(null, {
      id: tab.id,
      pathname: '/notes/saved.textpack',
      filename: 'saved.textpack',
      savedMarkdown: 'snapshot',
      markdown: '![image](assets/image.png)',
      documentKind: 'textpack',
      resourcePath: '/private/new-session'
    })
    expect(tab.markdown).toBe('![image](assets/image.png)')
    expect(tab.isSaved).toBe(true)
    expect(window.DIRNAME).toBe('/private/new-session')
  })

  it('retains concurrent edits and the dirty marker when conversion finishes', () => {
    const { tab, handler } = setup('snapshot with newer edits')
    const render = vi.spyOn(bus, 'emit')
    handler(null, {
      id: tab.id,
      pathname: '/notes/saved.textpack',
      filename: 'saved.textpack',
      savedMarkdown: 'snapshot',
      markdown: 'converted snapshot',
      documentKind: 'textpack',
      resourcePath: '/private/new-session'
    })
    expect(tab.markdown).toBe('snapshot with newer edits')
    expect(tab.isSaved).toBe(false)
    expect(tab.resourcePath).toBe('/private/new-session')
    expect(render).not.toHaveBeenCalledWith('file-changed', expect.anything())
    render.mockRestore()
  })

  it('keeps TextPack resources and unsaved edits when only the filename changes', () => {
    const { tab, handler } = setup()
    handler(null, { id: tab.id, pathname: '/moved/renamed.textpack', filename: 'renamed.textpack' })
    expect(tab.resourcePath).toBe('/private/session')
    expect(tab.documentKind).toBe('textpack')
    expect(tab.isSaved).toBe(false)
    expect(window.DIRNAME).toBe('/private/session')
  })

  it('updates a Markdown resource directory after a move', () => {
    const { tab, handler } = setup()
    tab.documentKind = 'markdown'
    tab.resourcePath = '/notes'
    handler(null, { id: tab.id, pathname: '/moved/renamed.md', filename: 'renamed.md' })
    expect(tab.resourcePath).toBe('/moved')
    expect(window.DIRNAME).toBe('/moved')
    expect(tab.isSaved).toBe(false)
  })
})
