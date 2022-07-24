import * as fs from 'fs/promises'
import * as cheerio from 'cheerio'

import {
  getTestStdout,
  mockActionsCoreLogging,
  createFakeGoModule,
  createSummaryFile,
  removeSummaryFile,
  testSummaryFilePath,
} from './helpers'
import { parseTestEvents } from '../src/events'
import Renderer from '../src/renderer'
import { SummaryTableCell } from '@actions/core/lib/summary'

const loadSummaryHTML = async (): Promise<cheerio.CheerioAPI> => {
  const file = await fs.readFile(testSummaryFilePath, { encoding: 'utf8' })
  return cheerio.load(file)
}

const getRenderer = async (): Promise<Renderer> => {
  const stdout = await getTestStdout()
  const testEvents = parseTestEvents(stdout)

  return new Renderer(
    'github.com/robherley/go-test-example',
    testEvents,
    '', // stderr
    false, // omitUntestedPackages
    false // omitPie
  )
}

describe('renderer', () => {
  beforeAll(async () => {
    await createFakeGoModule()
  })

  beforeEach(async () => {
    mockActionsCoreLogging()
    await createSummaryFile()
  })

  afterEach(async () => {
    await removeSummaryFile()
  })

  it('calculates package results and conclusions', async () => {
    const renderer = await getRenderer()

    expect(renderer.packageResults).toBeDefined()
    expect(renderer.packageResults).toHaveLength(4)

    expect(renderer.totalConclusions).toEqual({
      pass: 4,
      fail: 2,
      skip: 1,
    })

    const expected = [
      {
        packageName: 'github.com/robherley/go-test-example',
        conclusions: { pass: 0, fail: 0, skip: 0 },
        overallConclusion: 'skip',
        topLevelTestCount: 0,
        eventsCount: 0,
      },
      {
        packageName: 'github.com/robherley/go-test-example/boom',
        conclusions: { pass: 0, fail: 2, skip: 0 },
        overallConclusion: 'fail',
        topLevelTestCount: 2,
        eventsCount: 25,
      },
      {
        packageName: 'github.com/robherley/go-test-example/skipme',
        conclusions: { pass: 0, fail: 0, skip: 1 },
        overallConclusion: 'pass',
        topLevelTestCount: 1,
        eventsCount: 5,
      },
      {
        packageName: 'github.com/robherley/go-test-example/success',
        conclusions: { pass: 4, fail: 0, skip: 0 },
        overallConclusion: 'pass',
        topLevelTestCount: 1,
        eventsCount: 19,
      },
    ]

    renderer.packageResults.forEach((result, i) => {
      expect(result.packageEvent.package).toEqual(expected[i].packageName)
      expect(result.conclusions).toEqual(expected[i].conclusions)
      expect(result.packageEvent.action).toEqual(expected[i].overallConclusion)
      expect(Object.entries(result.tests)).toHaveLength(
        expected[i].topLevelTestCount
      )
      expect(result.events).toHaveLength(expected[i].eventsCount)
    })
  })

  it('renders nothing if there are no test events', async () => {
    const renderer = new Renderer(
      'github.com/robherley/empty-module',
      [],
      '',
      false,
      false
    )
    await renderer.writeSummary()

    const file = await fs.readFile(testSummaryFilePath, { encoding: 'utf8' })
    expect(file).toEqual('')
  })

  it('renders heading', async () => {
    const renderer = await getRenderer()
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($('h2').text()).toEqual('📝 Test results')
  })

  it('renders center div hack', async () => {
    const renderer = await getRenderer()
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($('div[align="center"]')).toHaveLength(1)
  })

  it('renders module name', async () => {
    const renderer = await getRenderer()
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()
    expect($('h3 code').text()).toEqual('github.com/robherley/go-test-example')
  })

  it('renders fallback when missing module name', async () => {
    const renderer = await getRenderer()
    renderer.moduleName = null
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($('h3 code').text()).toEqual('go test')
  })

  it('renders correct summary test', async () => {
    const renderer = await getRenderer()
    renderer.moduleName = null
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($.text()).toContain('7 tests (4 passed, 2 failed, 1 skipped)')
  })

  it('renders pie', async () => {
    const renderer = await getRenderer()
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    const pieData = `pie showData
"Passed" : 4
"Failed" : 2
"Skipped" : 1`
    expect($.text()).toContain('```mermaid')
    expect($.text()).toContain(pieData)
  })

  it('does not render pie when omitPie is true', async () => {
    const renderer = await getRenderer()
    renderer.omitPie = true
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($.text()).not.toContain('```mermaid')
  })

  it('renders table headers', async () => {
    const renderer = await getRenderer()
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    for (let header of renderer.headers) {
      const headerCell = header as SummaryTableCell
      expect($(`th:contains(${headerCell.data})`)).toHaveLength(1)
    }
  })

  it('renders correct number of table rows', async () => {
    const renderer = await getRenderer()
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($('tr')).toHaveLength(9)

    renderer.packageResults.forEach(result => {
      expect($(`td:contains(${result.packageEvent.package})`))
    })
  })

  it('renders correct number of table rows when omitUntestedPackages is true', async () => {
    const renderer = await getRenderer()
    renderer.omitUntestedPackages = true
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($('tr')).toHaveLength(7)
  })

  it('renders correct number of table rows when omitUntestedPackages is true', async () => {
    const renderer = await getRenderer()
    renderer.omitUntestedPackages = true
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($('tr')).toHaveLength(7)
  })

  it('does not render stderr when empty', async () => {
    const renderer = await getRenderer()
    renderer.stderr = ''
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($('summary:contains(Standard Error Output)')).toHaveLength(0)
  })

  it('renders stderr when specified', async () => {
    const renderer = await getRenderer()
    renderer.stderr = 'hello world'
    await renderer.writeSummary()
    const $ = await loadSummaryHTML()

    expect($('summary:contains(Standard Error Output)')).toHaveLength(1)
    expect($('details:contains(hello world)')).toHaveLength(1)
  })
})
