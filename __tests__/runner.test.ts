import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs/promises'
import path from 'path'
import * as actionsExec from '@actions/exec'

import {
  setupActionsInputs,
  testOutputDirectory,
  testModuleDirectory,
  testFixturesDirectory,
  mockProcessExit,
  createFakeGoModule,
  mockActionsCoreLogging,
} from './helpers.js'
import Runner from '../src/runner.js'
import Renderer from '../src/renderer.js'

describe('runner', () => {
  beforeAll(async () => {
    await createFakeGoModule()
  })

  beforeEach(() => {
    mockActionsCoreLogging()
    setupActionsInputs()
    delete process.env['INPUT_FROMJSONFILE']
    delete process.env['INPUT_FROMJSONFILES']
  })

  it('resolves module name from go.mod', async () => {
    const runner = new Runner()
    const modName = await runner.findModuleName()

    expect(modName).toBe('github.com/robherley/go-test-example')
  })

  it('returns null if missing module or go.mod', async () => {
    const emptyModule = path.join(testOutputDirectory, 'empty-mod')
    await fs.mkdir(emptyModule, { recursive: true })

    process.env['INPUT_MODULEDIRECTORY'] = emptyModule

    const runner = new Runner()
    const modName = await runner.findModuleName()

    expect(modName).toBeNull()
  })

  it('invokes exec with correct arguments', async () => {
    const spyExit = mockProcessExit()

    vi.spyOn(Renderer.prototype, 'writeSummary').mockImplementationOnce(
      async () => {}
    )

    const spy = vi.mocked(actionsExec.exec).mockImplementationOnce(async () => 0)

    const runner = new Runner()
    await runner.run()

    expect(spy).toHaveBeenCalledWith(
      'go',
      ['test', '-json', './...'],
      expect.objectContaining({
        cwd: testModuleDirectory,
        ignoreReturnCode: true,
      })
    )

    expect(spyExit).toHaveBeenCalledWith(0)
  })

  it('exits the process with non-zero exit code on failure', async () => {
    const spyExit = mockProcessExit()

    vi.spyOn(Renderer.prototype, 'writeSummary').mockImplementationOnce(
      async () => {}
    )

    vi.mocked(actionsExec.exec).mockImplementationOnce(async () => 2)

    const runner = new Runner()
    await runner.run()

    expect(spyExit).toHaveBeenCalledWith(2)
  })

  it('reads from a single JSON file via fromJSONFile', async () => {
    const spyExit = mockProcessExit()
    const spyWrite = vi
      .spyOn(Renderer.prototype, 'writeSummary')
      .mockImplementationOnce(async () => {})

    process.env['INPUT_FROMJSONFILE'] = path.join(
      testFixturesDirectory,
      'gotestoutput-part1.txt'
    )

    const runner = new Runner()
    await runner.run()

    expect(spyWrite).toHaveBeenCalled()
    expect(spyExit).toHaveBeenCalledWith(0)
  })

  it('reads and combines multiple JSON files via fromJSONFiles', async () => {
    const spyExit = mockProcessExit()
    const spyWrite = vi
      .spyOn(Renderer.prototype, 'writeSummary')
      .mockImplementationOnce(async () => {})

    const part1 = path.join(testFixturesDirectory, 'gotestoutput-part1.txt')
    const part2 = path.join(testFixturesDirectory, 'gotestoutput-part2.txt')
    process.env['INPUT_FROMJSONFILES'] = `${part1}\n${part2}`

    const runner = new Runner()
    await runner.run()

    expect(spyWrite).toHaveBeenCalled()
    expect(spyExit).toHaveBeenCalledWith(0)
  })

  it('throws when a file in fromJSONFiles does not exist', async () => {
    process.env['INPUT_FROMJSONFILES'] = `${path.join(
      testFixturesDirectory,
      'gotestoutput-part1.txt'
    )}\n/nonexistent/file.json`

    const runner = new Runner()
    await expect(runner.run()).rejects.toThrow()
  })
})
