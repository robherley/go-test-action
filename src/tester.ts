import * as path from 'path'
import { readFile } from 'fs/promises'

import * as core from '@actions/core'
import { exec } from '@actions/exec'

import Renderer from './renderer'

class Tester {
  moduleDirectory = '.'
  testArguments = ['./...']

  constructor() {
    this.getInputs()
  }

  async run() {
    const moduleName = await this.findModuleName()

    const { retCode, stdout, stderr } = await this.goTest()
    if (retCode > 0) {
      core.error(`\`go test\` returned nonzero exit code: ${retCode}`)
    }

    if (stderr.length !== 0) {
      core.warning(stderr)
    }

    const renderer = new Renderer(moduleName, stdout)
    await renderer.toSummary()

    process.exit(retCode)
  }

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

  private getInputs() {
    const moduleDirectory = core.getInput('moduleDirectory')
    if (moduleDirectory) {
      this.moduleDirectory = moduleDirectory
    }

    const testArguments = core.getInput('testArguments')
    if (testArguments) {
      this.testArguments = testArguments.split(/\s/).filter(arg => arg.length)
    }
  }
}

export default Tester
