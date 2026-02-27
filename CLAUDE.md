# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vehicle Control Center — a React + TypeScript + Tailwind CSS + Supabase fleet management app with delivery trips, order management, warehouse, commissions, and approval workflows with LINE/Telegram notifications. Deployed on Vercel.

## Commands

```bash
npm run dev           # Start dev server (Vite)
npm run build         # Production build
npm run preview       # Preview production build
npm run test          # Run tests in watch mode (Vitest)
npm run test:run      # Run tests once
npm run test:ui       # Vitest UI dashboard
npm run test:coverage # Coverage report
npm run gen:types     # Regenerate Supabase TypeScript types
npm run check         # Run check-dev.js validation
```

### Environment Setup
Copy `env.example` to `.env.local` and set:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Architecture

### Directory Layout
```
components/
  ui/          # Atomic reusable components (Button, Card, Input, Avatar, Skeleton, ConfirmDialog)
  layout/      # PageLayout, PageHeader
  [feature]/   # Feature-specific components (crew/, order/, product/, staff/, trip/, vehicle/)
views/         # Page-level orchestrator components (50+ views)
  reports/     # Report-specific views
hooks/         # Custom React hooks (useAuth, useDashboard, useDeliveryTripForm, useOrders, ...)
services/      # Business logic and Supabase API calls
  deliveryTrip/
  reports/
stores/        # Zustand global state stores
types/         # TypeScript type definitions (database.ts = generated Supabase types)
utils/         # Utility functions
theme/         # Design tokens (designTokens.ts)
supabase/
  functions/   # Edge Functions (auto-commission-worker, notification-worker, daily-summary-worker)
  migrations/  # Database migrations
sql/           # SQL scripts
```

### Component Hierarchy (CRITICAL)
Files have strict size limits enforced by convention:

| Type | Naming | Max Lines | Role |
|------|--------|-----------|------|
| `*View.tsx` | `views/` | ~400 | **Orchestrator only**: layout + hook destructuring + `<Section />` placement |
| `*Section.tsx` | `components/[feature]/` | ~350 | Large UI block within a page |
| `*Form.tsx` | `components/[feature]/` | ~350 | Form with specific fields |
| `hooks/*.ts` | `hooks/` | flexible | All state/logic for a domain |
| `components/ui/` | — | ~200 | Atomic reusable elements |

**When adding a feature**: if a view/component exceeds ~350–400 lines, stop and extract a Section/Form + hook before continuing. Never write long JSX directly in a View.

**View template**:
```tsx
const { ...form, ...sectionA, handleSubmit } = useXForm();
return (
  <PageLayout>
    <form onSubmit={handleSubmit}>
      <BasicInfoSection {...form} />
      <OrdersSection {...sectionA} />
      {error && <Message type="error" />}
      <Actions />
    </form>
  </PageLayout>
);
```

### State Management
- **Local**: `useState` for component-scoped state
- **Global**: Zustand stores (`stores/`)
- **Server state**: Custom hooks (`useVehicles`, `useTickets`, etc.) — always handle loading + error
- **Complex forms**: dedicated hooks (e.g. `useDeliveryTripForm`)

### Supabase
- All DB types come from `types/database.ts` (generated — run `npm run gen:types` after schema changes)
- RLS is enabled on all tables; respect it — use service role key only inside Edge Functions, never in frontend
- Storage buckets: `pending-pdfs/`, `signed-tickets/`, `vehicle-images/`
- Use `storageService.ts` for file uploads

## Code Conventions

### Notifications — NEVER use `alert()` or `confirm()`
Always use `useToast` + `<ToastContainer>`:
```tsx
const { toasts, success, error, warning, info, dismissToast } = useToast();
// In JSX:
<ToastContainer toasts={toasts} onDismiss={dismissToast} />
// Usage:
success('ดำเนินการสำเร็จ');
error(err.message || 'เกิดข้อผิดพลาด');
warning('ออเดอร์นี้ถูกกำหนดทริปแล้ว', 8000); // custom duration ms
```
For product warnings, use `formatProductWarning()` from `utils/productDisplay.ts` — show product name/code, never raw UUID.

### Styling
- 100% Tailwind CSS — no inline `style={{}}` (except truly dynamic values), no new CSS files
- Always add `dark:` variants; use `dark:bg-charcoal-900`, `dark:text-white`
- Custom color palette: `enterprise-{50|100|500|600|900}`, `charcoal-{800|900|950}`, `neon-{blue|green|alert}`

### Z-Index Layers
```
z-0    Base content
z-10   Cards, elevated content
z-20   Sticky headers
z-30   Fixed sidebars
z-40   Overlays / backdrops
z-50   Dropdowns, autocomplete, popovers
z-[60] Modals, dialogs
z-[70] Toasts, notifications
z-[100] Flyout menus
```
**Stacking context pitfall**: components with `backdrop-blur`, `opacity`, or `transform` create new stacking contexts. If a dropdown is inside a Card with blur, raise the Card's own z-index when the dropdown is open: `className={hasDropdown ? 'relative z-50' : ''}`.

### Input / Form Patterns
Always include dark mode classes on inputs. For number inputs, start with empty string to avoid auto-fill:
```tsx
const [quantity, setQuantity] = useState<string | number>('');
<input value={quantity === '' ? '' : quantity} onChange={(e) => setQuantity(e.target.value)} />
const total = (Number(quantity) || 0) * price; // convert on use
```

Always implement click-outside for dropdowns:
```tsx
const dropdownRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
      setShowDropdown(false);
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [showDropdown]);
// Attach ref to the container wrapping both input and dropdown, not just the dropdown
```

### TypeScript
- `interface` over `type` for component props
- `React.FC<Props>` for functional components
- DB types from `types/database.ts`: `Database['public']['Tables']['vehicles']['Row']`

### Data Fetching Pattern
```tsx
const { data, loading, error, refetch } = useVehicles();
if (loading) return <Skeleton />;
if (error) return <ErrorState onRetry={refetch} />;
if (!data?.length) return <EmptyState />;
return <DataDisplay data={data} />;
```
