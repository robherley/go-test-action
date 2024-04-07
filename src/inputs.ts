import * as core from '@actions/core'

export interface Inputs {
  moduleDirectory: string
  testArguments: string[]
  fromJSONFile: string | null
  omit: Set<OmitOption>
}

export enum OmitOption {
  // Omit untested packages from the summary
  Skipped = 'skipped',
  // Omit successful packages from the summary
  Successful = 'successful',
  // Omit the pie chart from the summary
  Pie = 'pie',
  // Omit the package test output
  PackageOutput = 'pkg-output',
  // Omit the package test list
  PackageTests = 'pkg-tests',
  // Omit stderr
  Stderr = 'stderr',
}

export const defaultInputs = (): Inputs => ({
  moduleDirectory: '.',
  testArguments: ['./...'],
  fromJSONFile: null,
  omit: new Set(),
})

/**
 * Parses the action inputs from the environment
 * @returns the parsed inputs
 */
export function getInputs(): Inputs {
  const inputs = defaultInputs()

  getDeprecatedOmitInputs().forEach(option => {
    inputs.omit.add(option)
  })

  const moduleDirectory = core.getInput('moduleDirectory')
  if (moduleDirectory) {
    inputs.moduleDirectory = moduleDirectory
  }

  const testArguments = core.getInput('testArguments')
  if (testArguments) {
    inputs.testArguments = testArguments.split(/\s/).filter(arg => arg.length)
  }

  const fromJSONFile = core.getInput('fromJSONFile')
  if (fromJSONFile) {
    inputs.fromJSONFile = fromJSONFile
  }

  const omit = core.getInput('omit')
  if (omit) {
    omit
      .split(/\s/)
      .filter(option =>
        Object.values(OmitOption).includes(option as OmitOption)
      )
      .forEach(option => inputs.omit.add(option as OmitOption))
  }

  return inputs
}

/**
 * Parses the deprecated omit inputs
 * @returns the parsed omit options
 */
function getDeprecatedOmitInputs(): OmitOption[] {
  const omitOptions: OmitOption[] = []
  const usedDeprecated: string[] = []

  const omitUntestedPackages = core.getInput('omitUntestedPackages')
  if (omitUntestedPackages) {
    usedDeprecated.push('omitUntestedPackages')
    if (core.getBooleanInput('omitUntestedPackages')) {
      omitOptions.push(OmitOption.Skipped)
    }
  }

  const omitSuccessfulPackages = core.getInput('omitSuccessfulPackages')
  if (omitSuccessfulPackages) {
    usedDeprecated.push('omitSuccessfulPackages')
    if (core.getBooleanInput('omitSuccessfulPackages')) {
      omitOptions.push(OmitOption.Successful)
    }
  }

  const omitPie = core.getInput('omitPie')
  if (omitPie) {
    usedDeprecated.push('omitPie')
    if (core.getBooleanInput('omitPie')) {
      omitOptions.push(OmitOption.Pie)
    }
  }

  if (usedDeprecated.length > 0) {
    core.warning(
      `The following inputs are deprecated and will be removed in the next major version: ${Array.from(
        usedDeprecated
      ).join(', ')}. Please use the \`omit\` input instead.`
    )
  }

  return omitOptions
}
