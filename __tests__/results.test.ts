import { getTestStdout, mockActionsCoreLogging } from './helpers'
import { TestEvent, parseTestEvents } from '../src/events'
import PackageResult from '../src/results'

const getPackageLevelEvent = (testEvents: TestEvent[]): TestEvent => {
  return testEvents.filter(
    event =>
      event.package === 'github.com/robherley/go-test-example/success' &&
      event.isPackageLevel &&
      event.isConclusive
  )[0]
}

describe('results', () => {
  beforeEach(() => {
    mockActionsCoreLogging()
  })

  it('converts events to results', async () => {
    const stdout = await getTestStdout()
    const testEvents = parseTestEvents(stdout)

    const packageEvent = getPackageLevelEvent(testEvents)
    const packageResult = new PackageResult(packageEvent, testEvents)

    expect(packageResult.testCount()).toEqual(4)
    expect(packageResult.hasTests()).toBeTruthy()
    expect(packageResult.tests).toEqual({
      TestSuccess: {
        conclusion: 'pass',
        subtests: {
          'TestSuccess/Subtest(1)': {
            conclusion: 'pass',
          },
          'TestSuccess/Subtest(2)': {
            conclusion: 'pass',
          },
          'TestSuccess/Subtest(3)': {
            conclusion: 'pass',
          },
        },
      },
    })
  })

  it('counts conclusions correctly', async () => {
    const stdout = await getTestStdout()
    const testEvents = parseTestEvents(stdout)

    const packageEvent = getPackageLevelEvent(testEvents)
    const packageResult = new PackageResult(packageEvent, testEvents)

    expect(packageResult.conclusions).toEqual({
      pass: 4,
      fail: 0,
      skip: 0,
    })
  })

  it('has correct output', async () => {
    const stdout = await getTestStdout()
    const testEvents = parseTestEvents(stdout)

    const packageEvent = getPackageLevelEvent(testEvents)
    const packageResult = new PackageResult(packageEvent, testEvents)

    expect(packageResult.output()).toEqual(`=== RUN   TestSuccess
=== RUN   TestSuccess/Subtest(1)
    success_test.go:19: hello from subtest #1
=== RUN   TestSuccess/Subtest(2)
    success_test.go:19: hello from subtest #2
=== RUN   TestSuccess/Subtest(3)
    success_test.go:19: hello from subtest #3
--- PASS: TestSuccess (0.00s)
    --- PASS: TestSuccess/Subtest(1) (0.00s)
    --- PASS: TestSuccess/Subtest(2) (0.00s)
    --- PASS: TestSuccess/Subtest(3) (0.00s)
`)
  })

  it('filters out any mismatched events by package', async () => {
    const stdout = await getTestStdout()
    const testEvents = parseTestEvents(stdout)

    const packageEvent = getPackageLevelEvent(testEvents)
    const packageResult = new PackageResult(packageEvent, testEvents)

    expect(packageResult.events).toHaveLength(19)
  })
})
