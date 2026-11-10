const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const net = require('node:net')
const { spawn, spawnSync } = require('node:child_process')
const { chromium } = require('playwright-core')

const executable = path.resolve(process.argv[2])
const input = path.resolve(process.argv[3])
const output = path.resolve(process.argv[4])
const editedFile = path.join(output, 'field-notes.textpack')
const savedText = 'A saved edit, with its local image still inside.'
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function unusedPort () {
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function launch (name) {
  const profile = path.join(output, name)
  await fs.mkdir(profile, { recursive: true })
  await fs.writeFile(
    path.join(profile, 'preferences.json'),
    JSON.stringify({ language: 'en', theme: 'light' })
  )
  const port = await unusedPort()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(
    executable,
    [
      `--remote-debugging-port=${port}`,
      '--remote-debugging-address=127.0.0.1',
      '--user-data-dir',
      profile,
      '--disable-spellcheck',
      editedFile
    ],
    { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
  )
  let diagnostics = ''
  child.stderr.on('data', (chunk) => {
    diagnostics = (diagnostics + chunk).slice(-10000)
  })
  let browser
  let page
  try {
    const deadline = Date.now() + 45000
    let endpoint
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Application exited: ${diagnostics}`)
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`)
        endpoint = (await response.json()).webSocketDebuggerUrl
        if (endpoint) break
      } catch {}
      await pause(250)
    }
    if (!endpoint) throw new Error(`Application debugging endpoint unavailable: ${diagnostics}`)
    browser = await chromium.connectOverCDP(endpoint)
    page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].waitForEvent('page'))
    await page.setViewportSize({ width: 1280, height: 880 })
    await page.locator('.editor-component[contenteditable="true"]').waitFor({ timeout: 30000 })
    await page.waitForFunction(() => document.body.innerText.includes('A note that travels'))
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.editor-component img')].some(
        (image) => image.complete && image.naturalWidth > 0
      )
    )
    return {
      page,
      close: async () => {
        await page.close().catch(() => {})
        await browser.close().catch(() => {})
        await pause(500)
        if (child.exitCode === null) {
          spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
        }
      }
    }
  } catch (error) {
    if (page) {
      await fs
        .writeFile(
          path.join(output, 'failed-renderer.json'),
          JSON.stringify(
            {
              url: page.url(),
              title: await page.title(),
              body: await page.locator('body').innerText(),
              diagnostics
            },
            null,
            2
          )
        )
        .catch(() => {})
      await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    }
    if (browser) await browser.close().catch(() => {})
    if (child.exitCode === null) {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
    }
    throw error
  }
}

;(async () => {
  await fs.mkdir(output, { recursive: true })
  await fs.copyFile(input, editedFile)
  const initial = await launch('profile-edit')
  try {
    await initial.page.screenshot({ path: path.join(output, 'editor-opened.png') })
    const before = (await fs.stat(editedFile)).mtimeMs
    await initial.page.bringToFront()
    await initial.page.locator('.editor-component span.mu-paragraph-content').last().click()
    await initial.page.keyboard.press('Control+End')
    await initial.page.keyboard.press('End')
    await initial.page.keyboard.press('Enter')
    await initial.page.keyboard.insertText(savedText)
    await initial.page.waitForFunction((text) => document.body.innerText.includes(text), savedText)
    await initial.page.screenshot({ path: path.join(output, 'editor-edited.png') })
    // The release disables the Node inspector; exercise its renderer Save action through CDP.
    await initial.page.evaluate(() => {
      const editor = document
        .querySelector('#app')
        .__vue_app__.config.globalProperties.$pinia._s.get('editor')
      if (typeof editor?.FILE_SAVE !== 'function') { throw new Error('The production Save action is unavailable') }
      editor.FILE_SAVE()
    })
    const deadline = Date.now() + 20000
    while ((await fs.stat(editedFile)).mtimeMs === before && Date.now() < deadline) await pause(100)
    assert.notEqual(
      (await fs.stat(editedFile)).mtimeMs,
      before,
      'Editing must update the TextPack on disk'
    )
  } catch (error) {
    await fs.writeFile(
      path.join(output, 'failed-renderer.json'),
      JSON.stringify(
        {
          error: String(error),
          title: await initial.page.title(),
          body: await initial.page.locator('body').innerText(),
          focus: await initial.page.evaluate(() => ({
            tag: document.activeElement?.tagName,
            classes: document.activeElement?.className
          }))
        },
        null,
        2
      )
    )
    await initial.page.screenshot({ path: path.join(output, 'failure.png') })
    throw error
  } finally {
    await initial.close()
  }
  const reopened = await launch('profile-reopen')
  try {
    await reopened.page.waitForFunction((text) => document.body.innerText.includes(text), savedText)
    await reopened.page.evaluate(() => document.fonts.ready)
    await reopened.page.screenshot({ path: path.join(output, 'editor.png') })
    await fs.writeFile(
      path.join(output, 'verification.json'),
      JSON.stringify(
        {
          application: 'Published Windows x64 TextPack 0.23.0 ZIP',
          opened: true,
          saved: true,
          reopened: true,
          localImageLoaded: true,
          saveAction: 'editor.FILE_SAVE',
          nativeSaveShortcutTested: false,
          title: await reopened.page.title(),
          savedText
        },
        null,
        2
      )
    )
    console.log(
      'Published application opened, edited, saved and reopened its TextPack with the local image intact'
    )
  } finally {
    await reopened.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
