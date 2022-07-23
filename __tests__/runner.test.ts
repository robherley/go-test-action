import * as fs from 'fs/promises'
import path from 'path'
import * as actionsExec from '@actions/exec'

import {
  setupActionsInputs,
  testOutputDirectory,
  testModuleDirectory,
  mockProcessExit,
  createFakeGoModule,
  mockActionsCoreLogging,
} from './helpers'
import Runner from '../src/runner'
import Renderer from '../src/renderer'

describe('runner', () => {
  beforeAll(async () => {
    await createFakeGoModule()
  })

  beforeEach(() => {
    mockActionsCoreLogging()
    setupActionsInputs()
  })

  it("sets defaults if inputs aren't set", async () => {
    delete process.env['INPUT_MODULEDIRECTORY']
    delete process.env['INPUT_TESTARGUMENTS']
    delete process.env['INPUT_OMITUNTESTEDPACKAGES']
    delete process.env['INPUT_OMITPIE']

    const runner = new Runner()
    expect(runner.moduleDirectory).toBe('.')
    expect(runner.testArguments).toEqual(['./...'])
    expect(runner.omitUntestedPackages).toEqual(false)
    expect(runner.omitPie).toEqual(false)
  })

  it('uses inputs if they are set', async () => {
    process.env['INPUT_MODULEDIRECTORY'] = '/some/random/directory'
    process.env['INPUT_TESTARGUMENTS'] = '-foo -bar\t-baz'
    process.env['INPUT_OMITUNTESTEDPACKAGES'] = 'true'
    process.env['INPUT_OMITPIE'] = 'true'

    const runner = new Runner()
    expect(runner.moduleDirectory).toBe('/some/random/directory')
    expect(runner.testArguments).toEqual(['-foo', '-bar', '-baz'])
    expect(runner.omitUntestedPackages).toEqual(true)
    expect(runner.omitPie).toEqual(true)
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

    jest
      .spyOn(Renderer.prototype, 'writeSummary')
      .mockImplementationOnce(async () => {})

    const spy = jest
      .spyOn(actionsExec, 'exec')
      .mockImplementationOnce(async () => 0)

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

    expect(spyExit).toBeCalledWith(0)
  })

  it('exits the process with non-zero exit code on failure', async () => {
    const spyExit = mockProcessExit()

    jest
      .spyOn(Renderer.prototype, 'writeSummary')
      .mockImplementationOnce(async () => {})

    jest.spyOn(actionsExec, 'exec').mockImplementationOnce(async () => 2)

    const runner = new Runner()
    await runner.run()

    expect(spyExit).toBeCalledWith(2)
  })
})
