import { describe, expect, it } from 'vitest'
import { sessionHarness } from '../fixtures/windowSessionHarness'
import { dirtyRecord } from '../fixtures/startupState'
import { createFileLocation } from '../../../src/main/applicationState/identity'
import { parseDocument } from '../../../src/main/applicationState/codec'
import type { DocumentSnapshot } from '@shared/types/applicationState'

const document = (extra: Partial<DocumentSnapshot> = {}): DocumentSnapshot => ({
  ...dirtyRecord().document,
  title: 'note.textpack',
  resource: { kind: 'file', pendingCreation: false, location: createFileLocation('/notes/note.textpack') },
  documentKind: 'textpack', resourcePath: '/private/fresh-session',
  ...extra
})
describe('TextPack durable restoration', () => {
  it('retains the private resource descriptor through the native metadata codec', () => {
    const restored = parseDocument(JSON.parse(JSON.stringify(document())))
    expect(restored).toMatchObject({ documentKind: 'textpack', resourcePath: '/private/fresh-session' })
  })
  it('initializes a dirty renderer document with the fresh native workspace', () => {
    const session = sessionHarness()
    const file = session._file({ document: document(), markdown: '# Unsaved', contentRevision: 1, selected: true })
    expect(file).toMatchObject({ documentKind: 'textpack', resourcePath: '/private/fresh-session', markdown: '# Unsaved', isSaved: false })
  })
  it('keeps older Markdown snapshots compatible without a resource descriptor', () => {
    const legacy = dirtyRecord().document
    const file = sessionHarness()._file({ document: legacy, markdown: '# Draft', contentRevision: 1, selected: true })
    expect(file.documentKind).toBe('markdown')
  })
})
