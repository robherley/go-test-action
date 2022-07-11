import * as fs from 'fs/promises'
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

export const setupActionsInputs = async () => {
  process.env['INPUT_MODULEDIRECTORY'] = testModuleDirectory
  process.env['INPUT_TESTARGUMENTS'] = testArguments
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
