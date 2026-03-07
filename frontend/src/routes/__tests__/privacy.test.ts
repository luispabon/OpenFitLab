import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Privacy from '../privacy.svelte';

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: { pendingSignup: true },
}));

vi.mock('../../lib/stores/auth.svelte', () => ({
  state: mockAuthState,
}));

vi.mock('../../lib/config/privacy.js', () => ({
  privacyConfig: {
    lastUpdated: '2024-01-01',
    region: 'United Kingdom',
    email: null,
    hasAnalytics: false,
    analyticsConfig: null,
  },
}));

describe('Privacy', () => {
  beforeEach(() => {
    mockAuthState.pendingSignup = true;
  });

  it('shows Back to terms link when pendingSignup and not embedded in modal', () => {
    render(Privacy, { props: { embeddedInModal: false } });
    expect(screen.getByRole('link', { name: 'Back to terms' })).toBeInTheDocument();
  });

  it('hides Back to terms link when embeddedInModal is true', () => {
    render(Privacy, { props: { embeddedInModal: true } });
    expect(screen.queryByRole('link', { name: 'Back to terms' })).not.toBeInTheDocument();
  });

  it('renders Privacy Policy heading and content', () => {
    render(Privacy, { props: {} });
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Last Updated:/)).toBeInTheDocument();
  });
});
