import * as path from 'path'
import { readFile } from 'fs/promises'

import * as core from '@actions/core'
import { exec } from '@actions/exec'

import Renderer from './renderer'

import { parseTestEvents } from './events'

class Runner {
  moduleDirectory = '.'
  testArguments = ['./...']
  omitUntestedPackages = false
  omitSuccessfulPackages = false
  omitPie = false
  fromJSONFile: string | null = null

  constructor() {
    this.getInputs()
  }

  /**
   * Runs the go tests, captures any output, builds annotations and write the summary
   */
  async run() {
    const moduleName = await this.findModuleName()

    if (this.fromJSONFile) {
      const stdout = await readFile(this.fromJSONFile)
      const testEvents = parseTestEvents(stdout.toString())

      const renderer = new Renderer(
        moduleName,
        testEvents,
        '',
        this.omitUntestedPackages,
        this.omitSuccessfulPackages,
        this.omitPie
      )
  
      await renderer.writeSummary()
  
      process.exit(0)
    } else {
      const { retCode, stdout, stderr } = await this.goTest()
      if (retCode > 0) {
        core.error(`\`go test\` returned nonzero exit code: ${retCode}`)
      }

      const testEvents = parseTestEvents(stdout)

      const renderer = new Renderer(
        moduleName,
        testEvents,
        stderr,
        this.omitUntestedPackages,
        this.omitSuccessfulPackages,
        this.omitPie
      )
  
      await renderer.writeSummary()
  
      process.exit(retCode)
    }
  }

  /**
   * Deduces go module name from go.mod in working directory
   * @returns go module name
   */
  async findModuleName(): Promise<string | null> {
    const modulePath = path.join(path.resolve(this.moduleDirectory), 'go.mod')

    try {
      const contents = await readFile(modulePath)
      const match = contents.toString().match(/module\s+.*/)
      if (!match) {
        throw 'no matching module line found'
      }
      return match[0].split(/module\s/)[1]
    } catch (err) {
      core.debug(`unable to parse module from go.mod: ${err}`)
      return null
    }
  }

  /**
   * Execs `go test` with specified arguments, capturing the output
   * @returns return code, stdout, stderr of `go test`
   */
  private async goTest(): Promise<{
    retCode: number
    stdout: string
    stderr: string
  }> {
    let stdout = ''
    let stderr = ''

    const opts = {
      cwd: this.moduleDirectory,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString()
        },
        stderr: (data: Buffer) => {
          stderr += data.toString()
        },
      },
    }

    const retCode = await exec(
      'go',
      ['test', '-json', ...this.testArguments],
      opts
    )

    return {
      retCode,
      stdout,
      stderr,
    }
  }

  /**
   * Parses GitHub Actions inputs from environment
   */
  private getInputs() {
    const moduleDirectory = core.getInput('moduleDirectory')
    if (moduleDirectory) {
      this.moduleDirectory = moduleDirectory
    }

    const testArguments = core.getInput('testArguments')
    if (testArguments) {
      this.testArguments = testArguments.split(/\s/).filter(arg => arg.length)
    }

    const omitUntestedPackages = core.getInput('omitUntestedPackages')
    if (omitUntestedPackages) {
      this.omitUntestedPackages = core.getBooleanInput('omitUntestedPackages')
    }

    const omitSuccessfulPackages = core.getInput('omitSuccessfulPackages')
    if (omitSuccessfulPackages) {
      this.omitSuccessfulPackages = core.getBooleanInput(
        'omitSuccessfulPackages'
      )
    }

    const omitPie = core.getInput('omitPie')
    if (omitPie) {
      this.omitPie = core.getBooleanInput('omitPie')
    }

    const fromJSONFile = core.getInput('fromJSONFile')
    if (fromJSONFile) {
      this.fromJSONFile = fromJSONFile
    }
  }
}

export default Runner
