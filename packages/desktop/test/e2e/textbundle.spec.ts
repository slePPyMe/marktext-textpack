import { expect, test, type Locator } from '@playwright/test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication } from 'playwright'
import { expectNoRendererErrors, launchElectron, openProjectFolder, sendIpcToRenderer } from './helpers'

const setSaveTarget = (app: ElectronApplication, target: string | null) =>
  app.evaluate(({ dialog }, filePath) => {
    const state = globalThis as typeof globalThis & {
      bundleTestDialog?: { defaultPath?: string; filters?: { extensions: string[] }[] }
    }
    delete state.bundleTestDialog
    dialog.showSaveDialog = (async(...args: unknown[]) => {
      state.bundleTestDialog = args.at(-1) as typeof state.bundleTestDialog
      return { canceled: filePath === null, filePath: filePath ?? '' }
    }) as typeof dialog.showSaveDialog
  }, target)

const selectedFormat = (app: ElectronApplication) => app.evaluate(() => {
  const state = globalThis as typeof globalThis & {
    bundleTestDialog?: { filters?: { extensions: string[] }[] }
  }
  return state.bundleTestDialog?.filters?.[0]?.extensions
})

const pastePixel = (editor: Locator) => editor.evaluate(node => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRQ0AAAAASUVORK5CYII='
  const bytes = Uint8Array.from(atob(png), char => char.charCodeAt(0))
  const transfer = new DataTransfer()
  transfer.items.add(new File([bytes], 'pixel.png', { type: 'image/png' }))
  node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
})

test('TextBundle first save, image staging, export and Save As use separate destinations', async() => {
  test.setTimeout(75_000)
  const root = mkdtempSync(join(tmpdir(), 'marktext-textbundle-e2e-'))
  const bundle = join(root, 'Camera Notes.textbundle')
  const body = join(bundle, 'text.md')
  const assets = join(bundle, 'assets')
  const exported = join(root, 'Sharing copy.textpack')
  const pack = join(root, 'Working copy.textpack')
  const roundTrip = join(root, 'Local copy.textbundle')
  let running: ElectronApplication | null = null
  try {
    const { app, page } = await launchElectron([], {
      preferences: { language: 'en', autoSave: false, tabBarVisibility: true },
      suppressErrorDialog: true
    })
    running = app
    const active = page.locator('.tabs-container > li.active')
    const editor = page.getByRole('textbox', { name: 'Document', exact: true })
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '')
    await editor.click()
    await page.keyboard.insertText('New note')
    await expect(editor).toContainText('New note')
    await setSaveTarget(app, null)
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(() => selectedFormat(app)).toContain('md')

    await page.evaluate(() => new Promise<void>((resolve) => {
      window.electron.ipcRenderer.once('mt::user-preference', () => resolve())
      window.electron.ipcRenderer.send('mt::set-user-preference', { newDocumentSaveFormat: 'textbundle' })
    }))
    await setSaveTarget(app, bundle)
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(() => selectedFormat(app)).toEqual(['textbundle'])
    await expect(active).toHaveAttribute('title', bundle)
    await expect(active).toContainText('Camera Notes')
    expect(readFileSync(body, 'utf8')).toContain('New note')
    expect(readdirSync(assets)).toEqual([])

    await page.evaluate(pathname => window.electron.ipcRenderer.send('mt::open-file', pathname, {}), body)
    await expect(page.locator('.tabs-container > li').filter({ hasText: 'Camera Notes' })).toHaveCount(1)
    await expect(active).toHaveAttribute('title', bundle)

    await editor.click()
    await page.keyboard.press('End')
    await pastePixel(editor)
    const staged = page.locator('img[src*="textbundle-staging"]').first()
    await expect.poll(() => staged.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1)
    await expect(active).toHaveClass(/unsaved/)
    expect(readdirSync(assets)).toEqual([])

    await setSaveTarget(app, exported)
    await app.evaluate(({ BrowserWindow, Menu }) => {
      const fileMenu = Menu.getApplicationMenu()?.items.find(item => item.label === 'File')
      const exportMenu = fileMenu?.submenu?.items.find(item => item.submenu?.items.some(child => child.label === 'Export as TextPack…'))
      const command = exportMenu?.submenu?.items.find(item => item.label === 'Export as TextPack…')
      const window = BrowserWindow.getAllWindows()[0]
      if (!command || !window) throw new Error('TextPack export menu was not found')
      command.click(command, window, {})
    })
    await expect.poll(() => existsSync(exported)).toBe(true)
    await expect(active).toHaveAttribute('title', bundle)
    await expect(active).toHaveClass(/unsaved/)
    expect(readdirSync(assets)).toEqual([])

    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(() => readFileSync(body, 'utf8')).toMatch(/assets\/[^)]+\.png/)
    await expect(active).not.toHaveClass(/unsaved/)
    expect(readdirSync(assets)).toHaveLength(1)

    await setSaveTarget(app, pack)
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save-as')
    await expect.poll(() => selectedFormat(app)).toEqual(['textbundle'])
    await expect(active).toHaveAttribute('title', pack)
    await setSaveTarget(app, roundTrip)
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save-as')
    await expect.poll(() => selectedFormat(app)).toEqual(['textpack'])
    await expect(active).toHaveAttribute('title', roundTrip)
    expect(readFileSync(join(roundTrip, 'text.md'), 'utf8')).toContain('assets/')
    await expectNoRendererErrors(app)
  } finally {
    if (running) await running.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('The sidebar and Quick Open treat a bundle as one document and watch its body', async() => {
  const root = mkdtempSync(join(tmpdir(), 'marktext-textbundle-sidebar-'))
  const notes = join(root, 'notes')
  const bundle = join(notes, 'Field Guide.textbundle')
  const text = join(bundle, 'text.md')
  mkdirSync(join(bundle, 'assets'), { recursive: true })
  writeFileSync(join(bundle, 'info.json'), '{"version":2}')
  writeFileSync(text, '# Initial state')
  writeFileSync(join(bundle, 'assets', 'Private.md'), '# Attachment\n\nExternal edit')
  let running: ElectronApplication | null = null
  try {
    const { app, page } = await launchElectron([], {
      preferences: { language: 'en', autoSave: false, sideBarVisibility: true, tabBarVisibility: true }
    })
    running = app
    await openProjectFolder(app, page, notes, bundle)
    const row = page.locator('.side-bar-file').filter({ hasText: 'Field Guide' })
    await expect(row).toHaveCount(1)
    await expect(row).toHaveAttribute('title', bundle)
    await expect(page.locator('.side-bar-folder').filter({ hasText: 'Field Guide' })).toHaveCount(0)
    await expect(page.locator('.side-bar-file').filter({ hasText: 'Private' })).toHaveCount(0)
    await sendIpcToRenderer(app, 'mt::execute-command-by-id', 'file.quick-open')
    const input = page.locator('input.search:visible').first()
    await input.pressSequentially('Field Guide')
    await expect(page.locator('.commands > li:visible').filter({ hasText: 'Field Guide' })).toHaveCount(1)
    await input.press('Enter')

    const editor = page.getByRole('textbox', { name: 'Document', exact: true })
    await expect(editor).toContainText('Initial state')
    writeFileSync(text, '# External edit')
    await expect(editor).toContainText('External edit')
    await expect(page.locator('.tabs-container > li.active')).toHaveAttribute('title', bundle)

    await page.locator('.side-bar .search-button').click()
    const search = page.locator('.side-bar-search .search-input')
    await search.fill('External edit')
    await search.press('Enter')
    await expect(page.locator('.search-result-item')).toHaveCount(1)
    await expect(page.locator('.search-result-item .search-result')).toHaveAttribute('title', bundle)
  } finally {
    if (running) await running.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('Launching with a bundle directory opens the document instead of the folder tree', async() => {
  const root = mkdtempSync(join(tmpdir(), 'marktext-textbundle-launch-'))
  const bundle = join(root, 'Direct Launch.textbundle')
  mkdirSync(bundle)
  writeFileSync(join(bundle, 'info.json'), '{"version":2}')
  writeFileSync(join(bundle, 'text.md'), '# Opened from a directory path')
  let running: ElectronApplication | null = null
  try {
    const { app, page } = await launchElectron([bundle], {
      preferences: { language: 'en', tabBarVisibility: true }
    })
    running = app
    await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Opened from a directory path')
    await expect(page.locator('.tabs-container > li.active')).toHaveAttribute('title', bundle)
  } finally {
    if (running) await running.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('Restoring an unsaved TextBundle keeps its edit and protects a newer on-disk body', async() => {
  test.setTimeout(45_000)
  const root = mkdtempSync(join(tmpdir(), 'marktext-textbundle-restore-'))
  const bundle = join(root, 'Recovered.textbundle')
  const body = join(bundle, 'text.md')
  const profile = join(root, 'profile')
  const states = join(profile, 'editorStates')
  const copy = join(root, 'Recovered local copy.textbundle')
  mkdirSync(bundle)
  writeFileSync(join(bundle, 'info.json'), '{"version":2}')
  writeFileSync(body, 'Original body\n')
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([bundle], {
      userDataDir: profile,
      preferences: { language: 'en', autoSave: false, startUpAction: 'restoreAll', tabBarVisibility: true }
    })
    running = first.app
    const editable = first.page.getByRole('textbox', { name: 'Document', exact: true })
    await expect(editable).toContainText('Original body')
    await editable.click()
    await first.page.keyboard.press('End')
    await first.page.keyboard.type(' local edit')
    await expect(editable).toContainText('Original body local edit')
    await pastePixel(editable)
    const staged = first.page.locator('img[src*="textbundle-staging"]').first()
    await expect.poll(() => staged.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1)
    await expect.poll(() => {
      for (const name of readdirSync(states)) {
        if (!name.endsWith('_editor_buffer_store.json')) continue
        const state = JSON.parse(readFileSync(join(states, name), 'utf8')) as {
          tabs: { pathname: string; isSaved: boolean; markdown: string; textBundleStagingId?: string }[]
        }
        const tab = state.tabs.find(item => item.pathname === bundle)
        if (tab) return tab
      }
      return null
    }, { timeout: 10_000 }).toMatchObject({
      isSaved: false,
      markdown: expect.stringContaining('local edit'),
      textBundleStagingId: expect.any(String)
    })
    await Promise.all([
      running.waitForEvent('close'),
      running.evaluate(({ app }) => { setTimeout(() => app.exit(0), 50) })
    ])
    running = null
    writeFileSync(body, 'External edit\n')

    const second = await launchElectron([], { userDataDir: profile })
    running = second.app
    const recovered = second.page.getByRole('textbox', { name: 'Document', exact: true })
    await expect(recovered).toContainText('Original body local edit')
    const recoveredImage = second.page.locator('img[src*="textbundle-staging"]').first()
    await expect.poll(() => recoveredImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1)
    await sendIpcToRenderer(second.app, 'mt::editor-ask-file-save')
    await expect(second.page.getByText(/The TextBundle changed while saving/)).toBeVisible()
    expect(readFileSync(body, 'utf8')).toBe('External edit\n')
    await setSaveTarget(second.app, copy)
    await sendIpcToRenderer(second.app, 'mt::editor-ask-file-save-as')
    await expect(second.page.locator('.tabs-container > li.active')).toHaveAttribute('title', copy)
    expect(readFileSync(join(copy, 'text.md'), 'utf8')).toMatch(/Original body\s+local edit.*assets\//)
    expect(readdirSync(join(copy, 'assets'))).toHaveLength(1)
  } finally {
    if (running) await running.close()
    rmSync(root, { recursive: true, force: true })
  }
})
