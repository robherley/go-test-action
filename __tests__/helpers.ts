import * as fs from 'fs/promises'
import * as core from '@actions/core'
import path from 'path'

export const testFixturesDirectory = path.join(__dirname, 'fixtures')
export const testOutputDirectory = path.join(__dirname, 'output')
export const testModuleDirectory = path.join(
  __dirname,
  'output',
  'go-test-example'
)
export const testArguments = './...'
export const testSummaryFilePath = path.join(
  testOutputDirectory,
  'test-summary.md'
)
export const testGoModContents = `
module github.com/robherley/go-test-example

go 1.18
`

export const createSummaryFile = async () => {
  process.env['GITHUB_STEP_SUMMARY'] = testSummaryFilePath
  await fs.writeFile(testSummaryFilePath, '', { encoding: 'utf8' })
  core.summary.emptyBuffer()
}

export const removeSummaryFile = async () => {
  delete process.env['GITHUB_STEP_SUMMARY']
  await fs.unlink(testSummaryFilePath)
  core.summary.emptyBuffer()
}

export const setupActionsInputs = () => {
  process.env['INPUT_MODULEDIRECTORY'] = testModuleDirectory
  process.env['INPUT_TESTARGUMENTS'] = testArguments
  process.env['INPUT_OMITUNTESTEDPACKAGES'] = 'false'
  process.env['INPUT_OMITPIE'] = 'false'
}

export const createFakeGoModule = async () => {
  await fs.mkdir(testModuleDirectory, { recursive: true })
  await fs.writeFile(
    path.join(testModuleDirectory, 'go.mod'),
    testGoModContents,
    {
      encoding: 'utf8',
    }
  )
}

export const mockProcessExit = (): jest.SpyInstance => {
  // @ts-ignore:next-line
  return jest.spyOn(process, 'exit').mockImplementationOnce(() => {})
}

export const getTestStdout = async (): Promise<string> => {
  const buf = await fs.readFile(
    path.join(testFixturesDirectory, 'gotestoutput.txt')
  )
  return buf.toString()
}

export const mockActionsCoreLogging = (silent = true) => {
  type LogFuncs = 'debug' | 'error' | 'warning' | 'notice' | 'info'
  const logMethods: LogFuncs[] = ['debug', 'error', 'warning', 'notice', 'info']
  logMethods.forEach(method => {
    jest
      .spyOn(core, method)
      .mockImplementation(
        (msg: string | Error, props?: core.AnnotationProperties) => {
          if (silent) return
          console.log(
            `[mock: core.${method}(${props ? JSON.stringify(props) : ''})]:`,
            msg
          )
        }
      )
  })
}
