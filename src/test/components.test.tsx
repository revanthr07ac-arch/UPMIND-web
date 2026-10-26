import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/common/Button';
import { Avatar } from '../components/common/Avatar';
import { Input } from '../components/common/Input';
import { EmptyState } from '../components/common/EmptyState';

describe('Common UI Components', () => {
  it('renders primary red accent button and handles clicks', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Request Materials</Button>);

    const btn = screen.getByRole('button', { name: /request materials/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-[#E5484D]');

    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders disabled button when isLoading is true', () => {
    render(<Button isLoading={true}>Submitting</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('renders Avatar with initials fallback and story ring', () => {
    render(<Avatar name="John Doe" size="lg" hasStory={true} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders Input with label, placeholder, and error states', () => {
    render(
      <Input
        label="Username"
        placeholder="your_username"
        error="Username is already taken"
      />
    );
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your_username')).toBeInTheDocument();
    expect(screen.getByText('Username is already taken')).toBeInTheDocument();
  });

  it('renders EmptyState with title and call-to-action button', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No posts found"
        description="Check back later for tutorials"
        action={{ label: 'Explore', onClick: handleAction }}
      />
    );

    expect(screen.getByText('No posts found')).toBeInTheDocument();
    expect(screen.getByText('Check back later for tutorials')).toBeInTheDocument();
    const actionBtn = screen.getByRole('button', { name: /explore/i });
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});
