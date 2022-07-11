import * as fs from 'fs/promises'
import path from 'path'
import * as actionsExec from '@actions/exec'

import {
  setupActionsInputs,
  testOutputDirectory,
  testModuleDirectory,
  mockProcessExit,
  createFakeGoModule,
} from './helpers'
import Tester from '../src/tester'
import Renderer from '../src/renderer'

describe('Tester', () => {
  beforeAll(async () => {
    await createFakeGoModule()
  })

  beforeEach(async () => {
    await setupActionsInputs()
  })

  it("sets defaults if inputs aren't set", async () => {
    delete process.env['INPUT_MODULEDIRECTORY']
    delete process.env['INPUT_TESTARGUMENTS']

    const tester = new Tester()
    expect(tester.moduleDirectory).toBe('.')
    expect(tester.testArguments).toEqual(['./...'])
  })

  it('uses inputs if they are set', async () => {
    process.env['INPUT_MODULEDIRECTORY'] = '/some/random/directory'
    process.env['INPUT_TESTARGUMENTS'] = '-foo -bar\t-baz'

    const tester = new Tester()
    expect(tester.moduleDirectory).toBe('/some/random/directory')
    expect(tester.testArguments).toEqual(['-foo', '-bar', '-baz'])
  })

  it('resolves module name from go.mod', async () => {
    const tester = new Tester()
    const modName = await tester.findModuleName()

    expect(modName).toBe('github.com/robherley/go-test-example')
  })

  it('returns null if missing module or go.mod', async () => {
    const emptyModule = path.join(testOutputDirectory, 'empty-mod')
    await fs.mkdir(emptyModule, { recursive: true })

    process.env['INPUT_MODULEDIRECTORY'] = emptyModule

    const tester = new Tester()
    const modName = await tester.findModuleName()

    expect(modName).toBeNull()
  })

  it('invokes exec with correct arguments', async () => {
    const spyExit = mockProcessExit()

    jest
      .spyOn(Renderer.prototype, 'toSummary')
      .mockImplementationOnce(async () => {})

    const spy = jest
      .spyOn(actionsExec, 'exec')
      .mockImplementationOnce(async () => 0)

    const tester = new Tester()
    await tester.run()

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
      .spyOn(Renderer.prototype, 'toSummary')
      .mockImplementationOnce(async () => {})

    jest.spyOn(actionsExec, 'exec').mockImplementationOnce(async () => 2)

    const tester = new Tester()
    await tester.run()

    expect(spyExit).toBeCalledWith(2)
  })
})
