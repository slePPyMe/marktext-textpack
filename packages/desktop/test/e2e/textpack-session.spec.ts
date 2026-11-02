import { test, expect } from '@playwright/test'
import { createWriteStream, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import yazl from 'yazl'
import type { ElectronApplication } from 'playwright'
import { launchElectron, setSourceMarkdown, sendIpcToRenderer, expectNoRendererErrors } from './helpers'

test('TextPack resources survive native save and dirty session recovery', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-textpack-session-e2e-'))
  const pathname = join(directory, 'note.textpack')
  const userDataDir = join(directory, 'profile')
  const zip = new yazl.ZipFile()
  zip.addBuffer(Buffer.from('{"version":2,"type":"net.daringfireball.markdown","custom":"preserved"}'), 'info.json')
  zip.addBuffer(Buffer.from('# Pack\n\n![pixel](assets/pixel.png)\n'), 'text.md')
  zip.addBuffer(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRQ0AAAAASUVORK5CYII=', 'base64'), 'assets/pixel.png')
  zip.end()
  await pipeline(zip.outputStream, createWriteStream(pathname))
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([pathname], { userDataDir, preferences: { language: 'en', autoSave: false }, suppressErrorDialog: true })
    running = first.app
    await expect(first.page.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Pack')
    const imageLoaded = (page: typeof first.page) => page.locator('img[src*="pixel.png"]').first().evaluate(image => (image as HTMLImageElement).naturalWidth)
    await expect.poll(() => imageLoaded(first.page)).toBe(1)
    const resourcePath = await first.page.evaluate(() => window.DIRNAME)
    expect(resourcePath).not.toBe(directory)
    const statePath = join(userDataDir, 'state', 'application-state.json')
    const state = () => JSON.parse(readFileSync(statePath, 'utf8'))
    await setSourceMarkdown(first.page, first.app, '# Saved\n\n![pixel](assets/pixel.png)\n')
    const originalArchive = readFileSync(pathname)
    await sendIpcToRenderer(first.app, 'mt::editor-ask-file-save')
    await expect.poll(() => readFileSync(pathname).equals(originalArchive)).toBe(false)
    await expect(first.page.locator('.tabs-container > li.unsaved')).toHaveCount(0)
    await expect.poll(() => state().session.windows[0].documents[0].content.kind).toBe('disk')
    await setSourceMarkdown(first.page, first.app, '# Recovered draft\n\n![pixel](assets/pixel.png)\n')
    await expect.poll(() => {
      const window = state().session.windows[0]
      const record = join(userDataDir, 'recovery', window.id, `${window.documents[0].id}.json`)
      try { return JSON.parse(readFileSync(record, 'utf8')).markdown } catch { return '' }
    }).toContain('Recovered draft')
    await expectNoRendererErrors(first.app)
    await first.app.close()
    running = null
    const restored = await launchElectron([], { userDataDir, suppressErrorDialog: true })
    running = restored.app
    await expect(restored.page.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Recovered draft')
    await expect.poll(() => imageLoaded(restored.page)).toBe(1)
    expect(await restored.page.evaluate(() => window.DIRNAME)).toBe(state().session.windows[0].documents[0].resourcePath)
    await sendIpcToRenderer(restored.app, 'mt::editor-ask-file-save')
    await expect.poll(() => state().session.windows[0].documents[0].content.kind).toBe('disk')
    await expectNoRendererErrors(restored.app)
    const closed = restored.page.waitForEvent('close')
    await restored.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    await closed
  } finally {
    if (running) await running.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
