import { vi } from 'vitest'

vi.mock('@actions/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@actions/core')>()
  return {
    ...actual,
    debug: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    notice: vi.fn(),
    info: vi.fn(),
  }
})

vi.mock('@actions/exec', async importOriginal => {
  const actual = await importOriginal<typeof import('@actions/exec')>()
  return {
    ...actual,
    exec: vi.fn(actual.exec),
  }
})
