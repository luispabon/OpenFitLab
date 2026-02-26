import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import UserMenu from '../../components/user-menu.svelte';

describe('user-menu', () => {
  it('renders initials when no avatar and triggers logout on click', async () => {
    const { getByText } = render(UserMenu, {
      props: { displayName: 'Alice Bob', avatarUrl: null, collapsed: false },
    });
    // Initials AB should be shown
    expect(getByText('AB')).toBeTruthy();

    const spy = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }) as unknown as Response);
    const btn = getByText('Logout');
    await fireEvent.click(btn);
    expect(spy).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });
});
