import * as path from 'path'
import { readFile } from 'fs/promises'

import * as core from '@actions/core'
import { exec } from '@actions/exec'

import Renderer from './renderer'
import { parseTestEvents } from './events'
import { Inputs, getInputs } from './inputs'

class Runner {
  inputs: Inputs

  constructor() {
    this.inputs = getInputs()
  }

  /**
   * Runs the go tests, captures any output, builds annotations and write the summary
   */
  async run() {
    const moduleName = await this.findModuleName()

    if (this.inputs.fromJSONFile) {
      const stdout = await readFile(this.inputs.fromJSONFile)
      const testEvents = parseTestEvents(stdout.toString())

      const renderer = new Renderer(
        moduleName,
        testEvents,
        '',
        this.inputs.omit
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
        this.inputs.omit
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
    const modulePath = path.join(
      path.resolve(this.inputs.moduleDirectory),
      'go.mod'
    )

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
      cwd: this.inputs.moduleDirectory,
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
      ['test', '-json', ...this.inputs.testArguments],
      opts
    )

    return {
      retCode,
      stdout,
      stderr,
    }
  }
}

export default Runner
