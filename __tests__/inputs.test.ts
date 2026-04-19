import * as core from '@actions/core'
import { OmitOption, getInputs } from '../src/inputs'

jest.mock('@actions/core')

const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>
const mockGetBooleanInput = core.getBooleanInput as jest.MockedFunction<
  typeof core.getBooleanInput
>

const mockInput = (name: string, value: string) => {
  mockGetInput.mockImplementation((n: string) => (n === name ? value : ''))
}

const mockInputs = (inputs: Record<string, string>) => {
  mockGetInput.mockImplementation((n: string) => inputs[n] ?? '')
}

describe('renderer', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('uses default values', () => {
    mockGetInput.mockReturnValue('')
    const inputs = getInputs()

    expect(inputs).toEqual({
      moduleDirectory: '.',
      testArguments: ['./...'],
      fromJSONFiles: null,
      omit: new Set(),
    })
  })

  it('parses moduleDirectory', () => {
    mockInput('moduleDirectory', 'foo')
    const inputs = getInputs()

    expect(inputs.moduleDirectory).toEqual('foo')
  })

  it('parses testArguments', () => {
    mockInput('testArguments', 'foo     bar')
    const inputs = getInputs()

    expect(inputs.testArguments).toEqual(['foo', 'bar'])
  })

  it('parses fromJSONFile as alias for fromJSONFiles', () => {
    mockInput('fromJSONFile', 'foo.json')
    const inputs = getInputs()

    expect(inputs.fromJSONFiles).toEqual(['foo.json'])
  })

  it('parses fromJSONFiles', () => {
    mockInput('fromJSONFiles', 'foo.json\nbar.json')
    const inputs = getInputs()

    expect(inputs.fromJSONFiles).toEqual(['foo.json', 'bar.json'])
  })

  it('trims whitespace and filters empty lines in fromJSONFiles', () => {
    mockInput('fromJSONFiles', '  foo.json  \n\n  bar.json\n')
    const inputs = getInputs()

    expect(inputs.fromJSONFiles).toEqual(['foo.json', 'bar.json'])
  })

  it('throws when both fromJSONFile and fromJSONFiles are set', () => {
    mockInputs({
      fromJSONFile: 'foo.json',
      fromJSONFiles: 'bar.json\nbaz.json',
    })

    expect(() => getInputs()).toThrow(
      'Cannot specify both fromJSONFile and fromJSONFiles'
    )
  })

  it('parses omit', () => {
    mockInput(
      'omit',
      [...Object.values(OmitOption), 'foo', 'bar', 'baz'].join('\n')
    )
    const inputs = getInputs()

    expect(inputs.omit).toEqual(new Set(Object.values(OmitOption)))
  })

  it('supports deprecated inputs', () => {
    mockGetInput.mockImplementation((name: string) => {
      switch (name) {
        case 'omitUntestedPackages':
        case 'omitSuccessfulPackages':
        case 'omitPie':
          return 'true'
        default:
          return ''
      }
    })

    mockGetBooleanInput.mockReturnValue(true)

    const inputs = getInputs()
    expect(inputs.omit).toEqual(
      new Set([OmitOption.Untested, OmitOption.Successful, OmitOption.Pie])
    )
    expect(core.warning).toHaveBeenCalled()
  })

  it('does not make an annotation if the deprecated inputs are not used', () => {
    mockGetInput.mockImplementation((name: string) => {
      switch (name) {
        case 'omitUntestedPackages':
        case 'omitSuccessfulPackages':
        case 'omitPie':
          return 'false'
        default:
          return ''
      }
    })
    mockGetBooleanInput.mockReturnValue(false)

    getInputs()
    expect(core.warning).not.toHaveBeenCalled()
  })
})
