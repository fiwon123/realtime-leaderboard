import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'

// Fail the test on any request the handlers do not cover, so a typo'd endpoint
// surfaces immediately instead of silently returning real network errors.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  server.resetHandlers()
  cleanup()
  // Theme/tutorial choices persist in localStorage; clear them so one test
  // cannot leak its preference into the next.
  localStorage.clear()
})

afterAll(() => server.close())
