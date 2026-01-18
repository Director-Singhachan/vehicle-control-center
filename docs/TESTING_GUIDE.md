# Testing Guide

## Overview
This project uses Vitest for unit testing. Tests are located in the `src/test/` directory.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests once (CI mode)
npm run test:run
```

## Test Structure

```
src/test/
├── setup.ts                    # Test setup and configuration
├── mocks/
│   └── supabase.ts            # Mock Supabase client
├── services/                   # Service unit tests
│   ├── staffVehicleUsageService.test.ts
│   ├── vehicleDocumentService.test.ts
│   └── ...
└── utils/                      # Utility function tests
    └── searchUtils.test.ts
```

## Writing Tests

### Example Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { myService } from '../../../services/myService';
import { supabase } from '../../../lib/supabase';

// Mock dependencies
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('myService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('myFunction', () => {
    it('should do something', async () => {
      // Arrange
      const mockData = { id: '1', name: 'Test' };
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockQuery);

      // Act
      const result = await myService.myFunction('1');

      // Assert
      expect(result).toEqual(mockData);
    });
  });
});
```

## Mocking Supabase

When mocking Supabase queries, ensure the mock supports method chaining:

```typescript
const createChainableMock = () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  // Make all methods return the chain object
  Object.keys(chain).forEach(key => {
    if (key !== 'limit') {
      (chain as any)[key] = vi.fn().mockReturnValue(chain);
    }
  });
  return chain;
};
```

## Test Coverage Goals

- **Services**: Minimum 70% coverage
- **Utils**: Minimum 80% coverage
- **Critical paths**: 100% coverage

## Best Practices

1. **Isolate tests**: Each test should be independent
2. **Mock external dependencies**: Don't make real API calls in tests
3. **Test error cases**: Always test error handling
4. **Use descriptive test names**: Test names should clearly describe what they test
5. **Arrange-Act-Assert**: Follow the AAA pattern

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Before deployment
