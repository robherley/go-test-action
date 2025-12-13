import * as path from 'path'
import { readFile } from 'fs/promises'
import { Writable } from 'stream'

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
    let buf = ''

    const outStream = new Writable({
      write(chunk, _, cb) {
        const output = chunk.toString('utf8')
        stdout += output
        buf += output

        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          if (line) {
            try {
              const parsed = JSON.parse(line)
              if (parsed.Output) {
                process.stdout.write(parsed.Output)
              }
            } catch (_) {
              process.stdout.write(line + '\n')
            }
          }
        }
        cb()
      },
    })

    const errStream = new Writable({
      write(chunk, _, cb) {
        const output = chunk.toString('utf8')
        stderr += output
        process.stderr.write(output + '\n')
        cb()
      },
    })

    const retCode = await exec(
      'go',
      ['test', '-json', ...this.inputs.testArguments],
      {
        cwd: this.inputs.moduleDirectory,
        ignoreReturnCode: true,
        outStream,
        errStream,
      }
    )

    return {
      retCode,
      stdout,
      stderr,
    }
  }
}

export default Runner
