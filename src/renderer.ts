import * as core from '@actions/core'
import { SummaryTableRow } from '@actions/core/lib/summary'

import {
  TestEvent,
  TestEventAction,
  TestEventActionConclusion,
} from './test-event'

type TestResults = { [key in TestEventActionConclusion]: number }

class Renderer {
  stdout: string
  moduleName: string | null
  testEvents: TestEvent[]

  constructor(moduleName: string | null, stdout: string) {
    this.moduleName = moduleName
    this.stdout = stdout
    this.testEvents = Renderer.parseTestEvents(stdout)
  }

  /**
   * Specific test actions that mark the conclusive state of a test
   */
  static conclusiveTestEvents: TestEventAction[] = ['pass', 'fail', 'skip']

  /**
   * Convert test2json raw JSON output to TestEvent
   * @param stdout raw stdout of go test process
   * @returns  parsed test events
   */
  static parseTestEvents(stdout: string): TestEvent[] {
    const events: TestEvent[] = []

    const lines = stdout.split('\n').filter(line => line.length !== 0)
    for (let line of lines) {
      try {
        const json = JSON.parse(line)
        events.push({
          time: json.Time && new Date(json.Time),
          action: json.Action as TestEventAction,
          package: json.Package,
          test: json.Test,
          elapsed: json.Elapsed,
          output: json.Output,
          isCached: json.Output?.includes('\t(cached)') || false,
          isSubtest: json.Test?.includes('/') || false, // afaik there isn't a better indicator in test2json
          isPackageLevel: typeof json.Test === 'undefined',
          isConclusive: Renderer.conclusiveTestEvents.includes(json.Action),
        })
      } catch {
        core.debug(`unable to parse line: ${line}`)
        continue
      }
    }

    return events
  }

  /**
   * Displayed emoji for a specific test event
   * @param action test event action
   * @returns an emoji
   */
  private emojiFor(action: TestEventAction): string {
    switch (action) {
      case 'pass':
        return '🟢'
      case 'fail':
        return '🔴'
      case 'skip':
        return '🟡'
      default:
        return '❓'
    }
  }

  /**
   * Generates a GitHub Actions job summary for the parsed test events
   * https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary
   */
  async toSummary() {
    const pkgLevelConclusiveEvents = this.testEvents
      .filter(event => event.isConclusive && event.isPackageLevel)
      .sort((a, b) => a.package.localeCompare(b.package))

    const results: TestResults = {
      pass: 0,
      fail: 0,
      skip: 0,
    }

    const rows: SummaryTableRow[] = [
      [
        { data: '📦 Package', header: true },
        { data: '🟢 Passed', header: true },
        { data: '🔴 Failed', header: true },
        { data: '🟡 Skipped', header: true },
        { data: '⏳ Duration', header: true },
      ],
    ]

    for (let event of pkgLevelConclusiveEvents) {
      const pkg = this.aggregatePackageTests(event)
      const pkgRows = this.renderPackageRows(
        event,
        pkg.results,
        pkg.tests,
        pkg.subtestMap
      )

      rows.push(...pkgRows)

      for (let key of Object.keys(results) as TestEventActionConclusion[]) {
        results[key] += pkg.results[key]
      }
    }

    const numTests = Object.values(results).reduce((a, b) => a + b)
    let summarized = `${numTests} test${numTests === 1 ? '' : 's'}`
    const additionalResults = []
    if (results.pass) {
      additionalResults.push(`${results.pass} passed`)
    }
    if (results.fail) {
      additionalResults.push(`${results.fail} failed`)
    }
    if (results.skip) {
      additionalResults.push(`${results.skip} skipped`)
    }
    if (additionalResults.length !== 0) {
      summarized += ` (${additionalResults.join(', ')})`
    }

    const pie = this.renderPie(results)

    await core.summary
      .addHeading('📝 Test results', 2)
      .addRaw('<div align="center">') // center alignment hack
      .addRaw(`<h3><code>${this.moduleName || 'go test'}</code></h3>`)
      .addRaw(summarized)
      .addRaw(pie)
      .addTable(rows)
      .addRaw('</div>')
      .write()
  }

  /**
   * For a package level test event, aggregate the results, tests and subtests
   * @param pkgEvent package level event
   * @returns results split by test count, top level tests and subtests
   */
  aggregatePackageTests(pkgEvent: TestEvent): {
    results: TestResults
    tests: TestEvent[]
    subtestMap: { [testName: string]: TestEvent[] }
  } {
    const results: TestResults = {
      pass: 0,
      fail: 0,
      skip: 0,
    }
    const tests: TestEvent[] = []
    const subtestMap: { [testName: string]: TestEvent[] } = {}

    const pkgConclusiveEvents = this.testEvents.filter(
      event =>
        event.package === pkgEvent.package &&
        !!event.test &&
        Renderer.conclusiveTestEvents.includes(event.action)
    )

    for (let event of pkgConclusiveEvents) {
      results[event.action as TestEventActionConclusion] += 1

      if (event.isSubtest) {
        const parent = event.test.split('/')[0]
        subtestMap[parent] = [...(subtestMap[parent] || []), event]
      } else {
        tests.push(event)
      }
    }

    return {
      results,
      tests,
      subtestMap,
    }
  }

  /**
   * For a given package event, renders the results, tests and subtests into SummaryTableRows
   * @param pkgEvent the package level event
   * @param results the results for the package level event
   * @param tests the top level tests for the package level event
   * @param subtestMap the mapping of subtests to top level test for the package level event
   * @returns summary table rows
   */
  private renderPackageRows(
    pkgEvent: TestEvent,
    results: TestResults,
    tests: TestEvent[],
    subtestMap: { [testName: string]: TestEvent[] }
  ): SummaryTableRow[] {
    let testList = ''
    for (let test of tests) {
      if (testList.length === 0) {
        testList += '<ul>'
      }
      testList += `<li>${this.emojiFor(test.action)}<code>${
        test.test
      }</code></li>`
      if (subtestMap[test.test]) {
        testList += '<ul>'
        for (let subTest of subtestMap[test.test]) {
          testList += `<li>${this.emojiFor(test.action)}<code>${
            subTest.test
          }</code></li>`
        }
        testList += '</ul>'
      }
    }
    if (testList.length !== 0) {
      testList += '</ul>'
    }

    const rawOutput = this.testEvents
      .filter(event => event.package === pkgEvent.package && !!event.output)
      .map(event => event.output)
      .join('')
    const detailsForOutput = `<details><summary>🖨️ Output</summary><pre><code>${
      rawOutput || '(none)'
    }</code></pre></details>`

    const detailsForTests = `<details><summary>🧪 Tests</summary>${
      testList || '(none)'
    }</details>`

    const pkgDisplay = `${this.emojiFor(pkgEvent.action)} <code>${
      pkgEvent.package
    }${pkgEvent.package === this.moduleName ? ' (main)' : ''}</code>`

    return [
      [
        pkgDisplay,
        results.pass.toString(),
        results.fail.toString(),
        results.skip.toString(),
        `${(pkgEvent.elapsed || 0) * 1000}ms`,
      ],
      [{ data: detailsForTests + detailsForOutput, colspan: '5' }],
    ]
  }

  /**
   * Returns a pie chart summarizing all test results
   * @param results overall test results
   * @returns stringified markdown for mermaid.js pie chart
   */
  private renderPie(results: TestResults): string {
    const pieConfig: any = {
      theme: 'base',
      themeVariables: {
        fontFamily: 'monospace',
        pieSectionTextSize: '24px',
        darkMode: true,
      },
    }

    let pieData = ''
    let pieIndex = 1
    if (results.pass) {
      pieData += `"Passed" : ${results.pass}\n`
      pieConfig.themeVariables[`pie${pieIndex}`] = '#2da44e'
      pieIndex++
    }

    if (results.fail) {
      pieData += `"Failed" : ${results.fail}\n`
      pieConfig.themeVariables[`pie${pieIndex}`] = '#cf222e'
      pieIndex++
    }

    if (results.skip) {
      pieData += `"Skipped" : ${results.skip}\n`
      pieConfig.themeVariables[`pie${pieIndex}`] = '#dbab0a'
      pieIndex++
    }

    return `
\n\`\`\`mermaid
%%{init: ${JSON.stringify(pieConfig)}}%%
pie showData
${pieData}
\`\`\`\n
`
  }
}

export default Renderer
