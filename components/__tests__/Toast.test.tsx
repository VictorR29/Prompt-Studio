import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../Toast';

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    message: 'Test message',
    type: 'success' as const,
    onClose: vi.fn(),
  };

  it('renders the message', () => {
    render(<Toast {...defaultProps} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Test" type="success" onClose={onClose} />);
    
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    vi.advanceTimersByTime(300);
    
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders with success type styling', () => {
    render(<Toast {...defaultProps} />);
    const toast = screen.getByText('Test message').closest('[role="alert"]');
    expect(toast).toBeInTheDocument();
  });

  it('renders with error type', () => {
    render(<Toast message="Error!" type="error" onClose={vi.fn()} />);
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('renders with warning type', () => {
    render(<Toast message="Warning!" type="warning" onClose={vi.fn()} />);
    expect(screen.getByText('Warning!')).toBeInTheDocument();
  });
});
