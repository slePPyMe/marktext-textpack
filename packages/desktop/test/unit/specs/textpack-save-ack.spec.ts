import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionHarness } from '../fixtures/windowSessionHarness'
import { dirtyRecord } from '../fixtures/startupState'
import { createDocumentState, getOptionsFromState } from '@/store/help'
import type { DocumentSnapshot, ManagedSaveResult } from '@shared/types/applicationState'

beforeEach(() => {
  Object.assign(window, { path: { dirname: (p: string) => p.substring(0, p.lastIndexOf('/')) } })
})
const setup = (markdown = 'snapshot') => {
  const tab = createDocumentState({ pathname: '/notes/original.textpack', filename: 'original.textpack', documentKind: 'textpack', resourcePath: '/private/session', markdown, isSaved: false })
  const emit = vi.fn()
  const session = sessionHarness(tab, emit)
  const document: DocumentSnapshot = {
    ...dirtyRecord().document, id: tab.id, title: 'saved.textpack', documentKind: 'textpack', resourcePath: '/private/new-session',
    resource: { kind: 'file', pendingCreation: false, location: { path: '/notes/saved.textpack', canonicalPath: '/notes/saved.textpack', key: 'a'.repeat(64) } },
    content: { kind: 'disk', baseline: { exists: true, rawSha256: 'a'.repeat(64), sizeBytes: 1, mtimeMs: 1 } }
  }
  const result: Extract<ManagedSaveResult, { status: 'saved' }> = { status: 'saved', document, savedMarkdown: '![image](assets/image.png)', sourceMarkdown: 'snapshot', sourceFormat: getOptionsFromState(tab), savedFormat: getOptionsFromState(tab), metadataRevision: 1 }
  return { tab, session, result, emit }
}
describe('TextPack native save acknowledgements and relocation', () => {
  it('applies converted Markdown only when the saved source still matches', () => {
    const { tab, session, result } = setup()
    session._saved(result)
    expect(tab.markdown).toBe('![image](assets/image.png)')
    expect(tab.isSaved).toBe(true)
    expect(window.DIRNAME).toBe('/private/new-session')
  })
  it('preserves concurrent edits and dirty state while applying the new resource directory', () => {
    const { tab, session, result, emit } = setup('snapshot with newer edits')
    session._saved(result)
    expect(tab.markdown).toBe('snapshot with newer edits')
    expect(tab.isSaved).toBe(false)
    expect(tab.resourcePath).toBe('/private/new-session')
    expect(emit).not.toHaveBeenCalled()
  })
  it('preserves unsaved text during a TextPack rename', () => {
    const { tab, session, result } = setup()
    session._applyResource(tab, { ...result.document, resourcePath: '/private/session' })
    expect(tab.resourcePath).toBe('/private/session')
    expect(tab.isSaved).toBe(false)
    expect(window.DIRNAME).toBe('/private/session')
  })
  it('updates the Markdown resource directory after a move', () => {
    const { tab, session, result } = setup()
    session._applyResource(tab, { ...result.document, documentKind: 'markdown' })
    expect(tab.resourcePath).toBe('/notes')
    expect(window.DIRNAME).toBe('/notes')
  })
})
