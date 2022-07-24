import * as core from '@actions/core'
import type { SummaryTableRow } from '@actions/core/lib/summary'

import type { ConclusionResults } from './results'
import PackageResult from './results'

import type {
  TestEvent,
  TestEventAction,
  TestEventActionConclusion,
} from './events'
import { conclusiveTestEvents } from './events'

class Renderer {
  moduleName: string | null
  testEvents: TestEvent[]
  stderr: string
  omitUntestedPackages: boolean
  omitPie: boolean
  packageResults: PackageResult[]
  headers: SummaryTableRow = [
    { data: '📦 Package', header: true },
    { data: '🟢 Passed', header: true },
    { data: '🔴 Failed', header: true },
    { data: '🟡 Skipped', header: true },
    { data: '⏳ Duration', header: true },
  ]
  totalConclusions: ConclusionResults = {
    pass: 0,
    fail: 0,
    skip: 0,
  }

  constructor(
    moduleName: string | null,
    testEvents: TestEvent[],
    stderr: string,
    omitUntestedPackages: boolean,
    omitPie: boolean
  ) {
    this.moduleName = moduleName
    this.testEvents = testEvents
    this.stderr = stderr
    this.omitUntestedPackages = omitUntestedPackages
    this.omitPie = omitPie
    this.packageResults = this.calculatePackageResults()
  }

  /**
   * Generates a GitHub Actions job summary for the parsed test events
   * https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary
   */
  async writeSummary() {
    const resultsToRender = this.packageResults.filter(result =>
      this.omitUntestedPackages ? result.hasTests() : true
    )

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
      .addTable(rows)
      .addRaw('</div>')
      .addRaw(this.renderStderr())
      .write()
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
      const otherPackageEvents = this.testEvents.filter(
        e => e.package === pkgEvent.package && !e.isPackageLevel
      )
      const packageResult = new PackageResult(pkgEvent, otherPackageEvents)
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

    return summarized
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

    const detailsForOutput = `<details><summary>🖨️ Output</summary><pre><code>${
      packageResult.output() || '(none)'
    }</code></pre></details>`

    const detailsForTests = `<details><summary>🧪 Tests</summary>${
      testList || '(none)'
    }</details>`

    const pkgName = `${this.emojiFor(
      packageResult.packageEvent.action
    )} <code>${packageResult.packageEvent.package}${
      packageResult.packageEvent.package === this.moduleName ? ' (main)' : ''
    }</code>`

    return [
      [
        pkgName,
        packageResult.conclusions.pass.toString(),
        packageResult.conclusions.fail.toString(),
        packageResult.conclusions.skip.toString(),
        `${(packageResult.packageEvent.elapsed || 0) * 1000}ms`,
      ],
      [{ data: detailsForTests + detailsForOutput, colspan: '5' }],
    ]
  }

  /**
   * Returns a pie chart summarizing all test results
   * @returns stringified markdown for mermaid.js pie chart
   */
  private renderPie(): string {
    if (this.omitPie) {
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
    return this.stderr
      ? `<details>
<summary>🚨 Standard Error Output</summary>

\`\`\`
${this.stderr}
\`\`\`

</details>`
      : ''
  }
}

export default Renderer
