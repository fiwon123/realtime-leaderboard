import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** MSW server used by `src/test/setup.ts` for the whole test run. */
export const server = setupServer(...handlers)
