import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Login from '../login.svelte';

const providersPayload = { google: true, github: true, apple: false, facebook: false };

function mockProvidersResponse(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

describe('login page', () => {
  const assign = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    assign.mockClear();
    Object.defineProperty(window, 'location', {
      value: { assign },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('renders only the enabled provider buttons', async () => {
    vi.stubGlobal('fetch', mockProvidersResponse(providersPayload));
    render(Login);
    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).toBeNull();
    expect(screen.queryByText('Facebook')).toBeNull();
  });

  it('shows no provider buttons until the capability response resolves', async () => {
    let resolveResponse: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending));
    render(Login);
    expect(screen.queryByText('Google')).toBeNull();
    expect(screen.queryByText('GitHub')).toBeNull();
    resolveResponse({
      ok: true,
      status: 200,
      json: () => Promise.resolve(providersPayload),
    });
    expect(await screen.findByText('Google')).toBeInTheDocument();
  });

  it('shows no provider buttons when the capability request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(Login);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText('Google')).toBeNull();
    expect(screen.queryByText('GitHub')).toBeNull();
    expect(screen.queryByText('Apple')).toBeNull();
    expect(screen.queryByText('Facebook')).toBeNull();
  });

  it('calls location.assign with Google OAuth URL when Google is clicked', async () => {
    vi.stubGlobal('fetch', mockProvidersResponse(providersPayload));
    render(Login);
    await fireEvent.click(await screen.findByText('Google'));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/api/auth/google');
  });

  it('calls location.assign with GitHub OAuth URL when GitHub is clicked', async () => {
    vi.stubGlobal('fetch', mockProvidersResponse(providersPayload));
    render(Login);
    await fireEvent.click(await screen.findByText('GitHub'));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/api/auth/github');
  });
});
