import * as core from '@actions/core'

import type { ConclusionResults } from './results.js'

export interface SummaryTableCell {
  data: string
  header?: boolean
  colspan?: string
  rowspan?: string
}

export type SummaryTableRow = (SummaryTableCell | string)[]

import PackageResult from './results.js'
import { OmitOption } from './inputs.js'

import type {
  TestEvent,
  TestEventAction,
  TestEventActionConclusion,
} from './events.js'
import { conclusiveTestEvents } from './events.js'

class Renderer {
  moduleName: string | null
  testEvents: TestEvent[]
  stderr: string
  omit: Set<OmitOption>
  packageResults: PackageResult[]
  totalConclusions: ConclusionResults = {
    pass: 0,
    fail: 0,
    skip: 0,
  }

  get headers(): SummaryTableRow {
    const headers: SummaryTableRow = [
      { data: '📦 Package', header: true },
      { data: '🟢 Passed', header: true },
      { data: '🔴 Failed', header: true },
      { data: '🟡 Skipped', header: true },
      { data: '⏳ Duration', header: true },
    ]
    if (this.hasCoverage()) {
      headers.push({ data: '📊 Coverage', header: true })
    }
    return headers
  }

  constructor(
    moduleName: string | null,
    testEvents: TestEvent[],
    stderr: string,
    omit: Set<OmitOption>
  ) {
    this.moduleName = moduleName
    this.testEvents = testEvents
    this.stderr = stderr
    this.omit = omit
    this.packageResults = this.calculatePackageResults()
  }

  /**
   * Generates a GitHub Actions job summary for the parsed test events
   * https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary
   */
  async writeSummary() {
    const resultsToRender = this.filterPackageResults()

    if (resultsToRender.length === 0) {
      core.debug('no packages with tests, skipping render')
      return
    }

    const rows: SummaryTableRow[] = [this.headers]
    for (let packageResult of resultsToRender) {
      rows.push(...this.renderPackageRows(packageResult))
    }

    await core.summary
      .addHeading('📝 Test results', 2)
      .addRaw('<div align="center">') // center alignment hack
      .addRaw(`<h3><code>${this.moduleName || 'go test'}</code></h3>`)
      .addRaw(this.renderSummaryText())
      .addRaw(this.renderPie())
      .addRaw('</div>')
      .addTable(rows)
      .addRaw(this.renderStderr())
      .write()
  }

  /**
   * Filters package results based on omit options
   * @returns filtered package results to render
   */
  private filterPackageResults(): PackageResult[] {
    let results = this.packageResults

    if (this.omit.has(OmitOption.Untested)) {
      results = results.filter(result => result.hasTests())
    }

    if (this.omit.has(OmitOption.Successful)) {
      results = results.filter(result => !result.onlySuccessfulTests())
    }

    return results
  }

  /**
   * Filter through test events and calculate the results per package
   * @returns list of package results
   */
  private calculatePackageResults(): PackageResult[] {
    const pkgLevelConclusiveEvents = this.testEvents
      .filter(event => event.isConclusive && event.isPackageLevel)
      .sort((a, b) => a.package.localeCompare(b.package))

    const packageResults: PackageResult[] = []
    for (let pkgEvent of pkgLevelConclusiveEvents) {
      const allPackageEvents = this.testEvents.filter(
        e => e.package === pkgEvent.package
      )
      const packageResult = new PackageResult(pkgEvent, allPackageEvents)
      for (let [key, value] of Object.entries(packageResult.conclusions)) {
        this.totalConclusions[key as TestEventActionConclusion] += value
      }
      packageResults.push(packageResult)
    }

    return packageResults
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
   * Renders out results text (ie: "4 tests (2 passed, 1 failed, 1 skipped)")
   * @returns results summary test
   */
  private renderSummaryText(): string {
    const totalTestCount = Object.values(this.totalConclusions).reduce(
      (a, b) => a + b
    )

    let summarized = `${totalTestCount} test${totalTestCount === 1 ? '' : 's'}`

    const conclusionText = conclusiveTestEvents
      .filter(c => this.totalConclusions[c])
      .map(c => `${this.totalConclusions[c]} ${c === 'skip' ? 'skipp' : c}ed`)
      .join(', ')

    if (conclusionText.length !== 0) {
      summarized += ` (${conclusionText})`
    }

    const overall = this.overallCoverage()
    if (overall !== undefined) {
      summarized += `<br>${this.formatCoverage(overall)} coverage`
    }

    return summarized
  }

  /**
   * Whether any package reports a coverage percentage
   */
  hasCoverage(): boolean {
    return this.packageResults.some(r => r.coverage !== undefined)
  }

  /**
   * Mean coverage across packages that report it, or undefined if none do
   */
  overallCoverage(): number | undefined {
    const coverages = this.packageResults
      .map(r => r.coverage)
      .filter((c): c is number => c !== undefined)
    if (coverages.length === 0) {
      return undefined
    }
    return coverages.reduce((a, b) => a + b, 0) / coverages.length
  }

  private formatCoverage(value: number): string {
    const segments = 10
    const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments)
    const bar = '█'.repeat(filled) + '░'.repeat(segments - filled)
    return `<code>${bar}</code> ${value.toFixed(1)}%`
  }

  /**
   * For a given package event, renders the results, tests and subtests into a SummaryTableRow
   * @param packageResult the package result
   * @returns summary table row
   */
  private renderPackageRows(packageResult: PackageResult): SummaryTableRow[] {
    const sortedTests = Object.entries(packageResult.tests).sort((a, b) =>
      a[0].localeCompare(b[0])
    )
    let testList = ''
    for (let [name, result] of sortedTests) {
      if (testList.length === 0) {
        testList += '<ul>'
      }
      testList += `<li>${this.emojiFor(
        result.conclusion!
      )}<code>${name}</code></li>`

      if (result.subtests && Object.entries(result.subtests).length) {
        const sortedSubtests = Object.entries(result.subtests).sort((a, b) =>
          a[0].localeCompare(b[0])
        )
        testList += '<ul>'
        for (let [subtestName, subTestResult] of sortedSubtests) {
          testList += `<li>${this.emojiFor(
            subTestResult.conclusion!
          )}<code>${subtestName}</code></li>`
        }
        testList += '</ul>'
      }
    }
    if (testList.length !== 0) {
      testList += '</ul>'
    }

    let details = ''

    if (!this.omit.has(OmitOption.PackageTests)) {
      details += `<details><summary>🧪 Tests</summary>${
        testList || '(none)'
      }</details>`
    }

    if (!this.omit.has(OmitOption.PackageOutput)) {
      details += `<details><summary>🖨️ Output</summary><pre><code>${
        this.scrubAnsi(packageResult.output()) || '(none)'
      }</code></pre></details>`
    }

    const pkgName = `${this.emojiFor(
      packageResult.packageEvent.action
    )} <code>${packageResult.packageEvent.package}${
      packageResult.packageEvent.package === this.moduleName ? ' (main)' : ''
    }</code>`

    const hasCoverage = this.hasCoverage()
    const row: SummaryTableRow = [
      pkgName,
      packageResult.conclusions.pass.toString(),
      packageResult.conclusions.fail.toString(),
      packageResult.conclusions.skip.toString(),
      `${(packageResult.packageEvent.elapsed || 0) * 1000}ms`,
    ]
    if (hasCoverage) {
      row.push(
        packageResult.coverage !== undefined
          ? this.formatCoverage(packageResult.coverage)
          : '—'
      )
    }

    const packageRows: SummaryTableRow[] = [row]
    if (details) {
      packageRows.push([
        { data: details, colspan: hasCoverage ? '6' : '5' },
      ])
    }

    return packageRows
  }

  /**
   * Returns a pie chart summarizing all test results
   * @returns stringified markdown for mermaid.js pie chart
   */
  private renderPie(): string {
    if (this.omit.has(OmitOption.Pie)) {
      return '<br><br>' // just return double break instead
    }

    const pieConfig: any = {
      theme: 'base',
      themeVariables: {
        fontFamily: 'monospace',
        pieSectionTextSize: '24px',
        darkMode: true,
      },
    }

    const keys: {
      [key in TestEventActionConclusion]: { word: string; color: string }
    } = {
      pass: { color: '#2da44e', word: 'Passed' },
      fail: { color: '#cf222e', word: 'Failed' },
      skip: { color: '#dbab0a', word: 'Skipped' },
    }

    let pieIndex = 1
    const pieData = conclusiveTestEvents
      .map(conclusion => {
        if (!this.totalConclusions[conclusion]) {
          return ''
        }

        pieConfig.themeVariables[`pie${pieIndex}`] = keys[conclusion].color
        pieIndex++
        return `"${keys[conclusion].word}" : ${this.totalConclusions[conclusion]}\n`
      })
      .join('')

    return `
\n\`\`\`mermaid
%%{init: ${JSON.stringify(pieConfig)}}%%
pie showData
${pieData}
\`\`\`\n
`
  }

  private renderStderr(): string {
    if (this.omit.has(OmitOption.Stderr) || !this.stderr) {
      return ''
    }

    return `<details>
<summary>🚨 Standard Error Output</summary>

\`\`\`
${this.scrubAnsi(this.stderr)}
\`\`\`

</details>`
  }

  private scrubAnsi(input: string): string {
    return input.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
  }
}

export default Renderer
