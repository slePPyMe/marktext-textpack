import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'
import { createDocumentState, getOptionsFromState } from '@/store/help'
import type { IFileState } from '@shared/types/files'
import type { DocumentSnapshot, ManagedDocumentPayload, ManagedSaveResult } from '@shared/types/applicationState'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/renderer/src/services/windowSession.ts'), 'utf8')
// Run the production class without initializing native IPC or Vue's editor bindings.
const compiled = ts.transpileModule(source.slice(source.indexOf('class WindowSession'), source.indexOf('export const startWindowSession')), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
interface SessionUnderTest {
  _file(payload: ManagedDocumentPayload): IFileState
  _applyResource(file: IFileState, document: DocumentSnapshot): void
  _saved(result: Extract<ManagedSaveResult, { status: 'saved' }>): void
}
export const sessionHarness = (file?: IFileState, emit = () => {}) => {
  const editor = { currentFile: file ?? null, tabs: file ? [file] : [] }
  const noop = () => ({})
  const debounce = (fn: () => void) => Object.assign(() => {}, { cancel: () => {}, flush: fn })
  const Session = new Function('useEditorStore', 'useLayoutStore', 'usePreferencesStore', 'useProjectStore', 'useMainStore', 'debounce', 'createDocumentState', 'getOptionsFromState', 'deepClone', 'bus', `${compiled}\nreturn WindowSession`)(
    () => editor, noop, noop, noop, noop, debounce, createDocumentState, getOptionsFromState,
    (value: unknown) => JSON.parse(JSON.stringify(value)), { emit }
  ) as new() => SessionUnderTest
  return new Session()
}
