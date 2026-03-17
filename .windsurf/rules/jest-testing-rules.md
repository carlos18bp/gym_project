---
trigger: model_decision
description: Jest and testing-library best practices for React, Vue, Next.js, and Nuxt projects. Use when writing unit tests, component tests, mocking, or working with test files (.test.ts, .test.tsx, .spec.ts, .spec.vue).
---

# Jest & Testing Library Rules

## Test File Structure

Place test files next to the source code they test:

```
components/
├── UserCard.tsx
├── UserCard.test.tsx      ← React/Next
├── UserCard.vue
└── UserCard.spec.ts       ← Vue/Nuxt
```

Use `.test.ts(x)` for React/Next projects and `.spec.ts` for Vue/Nuxt projects. Be consistent within each project.

## Test Anatomy

Follow Arrange → Act → Assert pattern. One concept per test.

```typescript
// ✅ Clear structure
describe('UserCard', () => {
  it('should display user name and email', () => {
    // Arrange
    const user = { name: 'Ana', email: 'ana@test.com' }

    // Act
    render(<UserCard user={user} />)

    // Assert
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('ana@test.com')).toBeInTheDocument()
  })
})

// ❌ Multiple unrelated assertions
it('should work', () => {
  render(<UserCard user={user} />)
  expect(screen.getByText('Ana')).toBeInTheDocument()
  expect(handleClick).not.toHaveBeenCalled()
  expect(container).toMatchSnapshot()
  expect(screen.queryByText('error')).not.toBeInTheDocument()
})
```

## Naming Conventions

Use descriptive names that read as sentences:

```typescript
// ✅ Descriptive
describe('LoginForm', () => {
  it('should show validation error when email is empty')
  it('should call onSubmit with form data when valid')
  it('should disable button while submitting')
})

// ❌ Vague
describe('LoginForm', () => {
  it('works')
  it('handles error')
  it('button test')
})
```

## Testing Library: Query Priority

Always prefer queries that reflect how users interact:

```typescript
// ✅ Priority order (best to worst)
screen.getByRole('button', { name: /submit/i })   // 1st: Role
screen.getByLabelText('Email')                      // 2nd: Label
screen.getByPlaceholderText('Enter email')          // 3rd: Placeholder
screen.getByText('Submit')                          // 4th: Text
screen.getByTestId('submit-btn')                    // Last resort

// ❌ Never as first choice
document.querySelector('.btn-submit')
container.firstChild
```

## React Testing (with @testing-library/react)

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('SearchBar', () => {
  it('should call onSearch after user types and submits', async () => {
    const user = userEvent.setup()
    const onSearch = jest.fn()

    render(<SearchBar onSearch={onSearch} />)

    await user.type(screen.getByRole('searchbox'), 'django rest')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(onSearch).toHaveBeenCalledWith('django rest')
  })
})
```

Always use `userEvent` over `fireEvent` — it simulates real browser behavior.

## Vue Testing (with @vue/test-utils + @testing-library/vue)

```typescript
// With @testing-library/vue (preferred)
import { render, screen } from '@testing-library/vue'
import UserProfile from './UserProfile.vue'

describe('UserProfile', () => {
  it('should render user info from props', () => {
    render(UserProfile, {
      props: { name: 'Carlos', role: 'Developer' }
    })

    expect(screen.getByText('Carlos')).toBeInTheDocument()
    expect(screen.getByText('Developer')).toBeInTheDocument()
  })
})

// With @vue/test-utils (for deeper component testing)
import { mount } from '@vue/test-utils'

describe('Counter', () => {
  it('should increment count on button click', async () => {
    const wrapper = mount(Counter)

    await wrapper.find('button').trigger('click')

    expect(wrapper.find('[data-testid="count"]').text()).toBe('1')
  })
})
```

## Mocking

### Mock modules

```typescript
// Mock an entire module
jest.mock('@/services/api', () => ({
  fetchUsers: jest.fn(),
}))

// Mock with implementation
import { fetchUsers } from '@/services/api'
const mockFetchUsers = fetchUsers as jest.MockedFunction<typeof fetchUsers>

beforeEach(() => {
  mockFetchUsers.mockResolvedValue([
    { id: 1, name: 'Ana' },
  ])
})
```

### Mock API calls (MSW preferred over manual mocks for integration tests)

```typescript
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json([{ id: 1, name: 'Ana' }]))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Do NOT mock

- Implementation details (internal state, private methods)
- The component you are testing
- Standard library functions unless necessary

## Async Testing

```typescript
// ✅ Use findBy* for async elements (auto-waits)
const userName = await screen.findByText('Ana')

// ✅ Use waitFor for assertions on async state
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// ✅ Use waitForElementToBeRemoved for loading states
render(<UserList />)
await waitForElementToBeRemoved(() => screen.getByText('Loading...'))
expect(screen.getByText('Ana')).toBeInTheDocument()

// ❌ Never use arbitrary timeouts
await new Promise(resolve => setTimeout(resolve, 1000))
```

## Test Data

Use factories, never hardcode data across tests:

```typescript
// ✅ Factory function
const createUser = (overrides = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'developer',
  ...overrides,
})

it('should show admin badge for admin users', () => {
  const admin = createUser({ role: 'admin' })
  render(<UserCard user={admin} />)
  expect(screen.getByText('Admin')).toBeInTheDocument()
})

// ❌ Hardcoded everywhere
it('should show admin badge', () => {
  render(<UserCard user={{ id: 1, name: 'John', email: 'john@test.com', role: 'admin' }} />)
})
```

## Test Cleanup

```typescript
// Jest + testing-library auto-cleans after each test
// But for manual cleanup:

afterEach(() => {
  jest.restoreAllMocks()    // Restore all mocks
  jest.clearAllTimers()      // Clear fake timers if used
})

// ❌ Never leave global state
let globalData: any[]  // Don't do this
```

## What to Test / What NOT to Test

### Test
- User-visible behavior (text, interactions, navigation)
- Component props → rendered output
- User events → state changes → UI updates
- Error states and edge cases
- Loading states
- Conditional rendering
- Form validation

### Do NOT test
- Implementation details (internal state, method names)
- CSS class names or inline styles
- Third-party library internals
- Exact HTML structure (use roles/text instead)
- Constants or static values

## Coverage

Aim for meaningful coverage, not 100%:

```json
// jest.config.js or package.json
{
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 70,
      "lines": 80,
      "statements": 80
    }
  }
}
```

## Avoid These Anti-Patterns

- Testing implementation details instead of behavior
- Snapshot tests as primary testing strategy (use sparingly)
- Tests that pass when the feature is broken
- Tests that break when refactoring without behavior change
- Copying test code instead of using helpers/factories
- Testing the framework (Vue/React) instead of your code
- `act()` warnings — usually means you're not awaiting async properly