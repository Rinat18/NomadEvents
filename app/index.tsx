import { Redirect } from 'expo-router';

import { getIsAuthenticated } from '@/lib/local-auth';

export default function Index() {
  // This will be handled by _layout.tsx auth guard
  // Just redirect to onboarding as default, _layout will handle the actual routing
  return <Redirect href="/onboarding" />;
}

