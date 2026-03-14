import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import UserMenu from '../../components/user-menu.svelte';

vi.mock('svelte-spa-router', () => ({ push: vi.fn(), replace: vi.fn() }));

describe('user-menu', () => {
  it('renders initials "U" when displayName is null', () => {
    const { getByText } = render(UserMenu, {
      props: { displayName: null, avatarUrl: null, collapsed: false },
    });
    expect(getByText('U')).toBeTruthy();
  });

  it('renders initials "U" when displayName is whitespace only', () => {
    const { getByText } = render(UserMenu, {
      props: { displayName: '   ', avatarUrl: null, collapsed: false },
    });
    expect(getByText('U')).toBeTruthy();
  });

  it('renders initials when no avatar and triggers logout on click', async () => {
    const { getByText } = render(UserMenu, {
      props: { displayName: 'Alice Bob', avatarUrl: null, collapsed: false },
    });
    // Initials AB should be shown
    expect(getByText('AB')).toBeTruthy();

    const spy = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }) as unknown as Response);
    const btn = getByText('Logout');
    await fireEvent.click(btn);
    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
    expect(spy).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('calls replace("/") after logout', async () => {
    const { replace } = await import('svelte-spa-router');
    vi.spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }) as unknown as Response
    );
    const { getByText } = render(UserMenu, {
      props: { displayName: 'Alice', avatarUrl: null, collapsed: false },
    });
    await fireEvent.click(getByText('Logout'));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });
});
