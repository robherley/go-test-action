import type { TestEvent, TestEventActionConclusion } from './events'

export type TestResults = { [testName: string]: TestResult }
export type ConclusionResults = { [key in TestEventActionConclusion]: number }

export interface TestResult {
  conclusion?: TestEventActionConclusion
  subtests?: TestResults
}

class PackageResult {
  packageEvent: TestEvent
  events: TestEvent[]
  tests: TestResults = {}
  conclusions: ConclusionResults = {
    pass: 0,
    fail: 0,
    skip: 0,
  }

  constructor(packageEvent: TestEvent, events: TestEvent[]) {
    this.packageEvent = packageEvent
    this.events = events.filter(
      e => !e.isPackageLevel && e.package === this.packageEvent.package
    )

    this.eventsToResults()
  }

  public testCount(): number {
    return Object.values(this.conclusions).reduce((a, b) => a + b)
  }

  public hasTests(): boolean {
    return this.testCount() !== 0
  }

  public onlySuccessfulTests(): boolean {
    return this.conclusions.skip === 0 && this.conclusions.fail === 0
  }

  public output(): string {
    return this.events.map(e => e.output).join('')
  }

  /**
   * Iterate through test events, find anything that is a conclusive results and record it
   */
  private eventsToResults() {
    for (let event of this.events) {
      if (!event.isConclusive) {
        // if the event doesn't have a conclusion action, we don't need anything else from it
        continue
      }

      const conclusion = event.action as TestEventActionConclusion
      this.conclusions[conclusion] += 1

      if (event.isSubtest) {
        const parentEvent = event.test.split('/')[0]

        this.tests[parentEvent] = {
          ...(this.tests[parentEvent] || {}),
          subtests: {
            [event.test]: { conclusion },
            ...this.tests[parentEvent]?.subtests,
          },
        }
      } else {
        this.tests[event.test] = {
          conclusion: event.action as TestEventActionConclusion,
          subtests: this.tests[event.test]?.subtests || {},
        }
      }
    }
  }
}

export default PackageResult
