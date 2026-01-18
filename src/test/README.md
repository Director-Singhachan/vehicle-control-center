# Test Directory

This directory contains all unit tests for the Vehicle Control Center application.

## Structure

```
src/test/
├── setup.ts                    # Test setup and configuration
├── mocks/                      # Mock implementations
│   └── supabase.ts            # Mock Supabase client
├── services/                   # Service layer tests
│   ├── staffVehicleUsageService.test.ts
│   └── vehicleDocumentService.test.ts
└── utils/                      # Utility function tests
    └── searchUtils.test.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Organization

- **services/**: Tests for API service functions
- **utils/**: Tests for utility functions
- **mocks/**: Shared mock implementations

## Adding New Tests

When adding a new test file:
1. Place it in the appropriate subdirectory (`services/`, `utils/`, etc.)
2. Follow the naming convention: `*.test.ts`
3. Use descriptive test names
4. Mock external dependencies

## Coverage Goals

- **Services**: Minimum 70% coverage
- **Utils**: Minimum 80% coverage
- **Critical paths**: 100% coverage
