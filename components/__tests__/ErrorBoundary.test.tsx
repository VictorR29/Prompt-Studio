import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { type ReactNode, Component } from 'react';

// Helper: a child component that can throw on demand
class ThrowChild extends Component<{ shouldThrow?: boolean; label?: string }> {
  render(): ReactNode {
    if (this.props.shouldThrow) {
      throw new Error('Test rendering error');
    }
    return <div>{this.props.label ?? 'Normal child'}</div>;
  }
}

// Helper: a stable child that never throws
const StableChild = () => <div>Stable content</div>;

describe('ErrorBoundary', () => {
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary viewName="TestView">
        <StableChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Stable content')).toBeInTheDocument();
  });

  it('shows fallback UI when a child throws', () => {
    render(
      <ErrorBoundary viewName="TestView">
        <ThrowChild shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(
      screen.getByText('Ocurrió un error inesperado en esta sección. Podés intentar de nuevo.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('does NOT expose error details in the fallback UI', () => {
    render(
      <ErrorBoundary viewName="TestView">
        <ThrowChild shouldThrow />
      </ErrorBoundary>
    );
    // Error details like the message must NOT appear in the DOM
    expect(screen.queryByText('Test rendering error')).not.toBeInTheDocument();
  });

  it('logs the error in a structured console group with viewName', () => {
    render(
      <ErrorBoundary viewName="GalleryView">
        <ThrowChild shouldThrow />
      </ErrorBoundary>
    );
    expect(consoleGroupSpy).toHaveBeenCalledWith('[ErrorBoundary] GalleryView');
    expect(consoleGroupEndSpy).toHaveBeenCalled();
  });

  it('resets error state and remounts children when "Reintentar" is clicked', () => {
    // Step 1: Render with a crashing child → fallback shows
    const { rerender } = render(
      <ErrorBoundary viewName="TestView">
        <ThrowChild shouldThrow label="Fixed content" />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();

    // Step 2: Replace children with non-throwing version (simulating fix before retry)
    rerender(
      <ErrorBoundary viewName="TestView">
        <ThrowChild shouldThrow={false} label="Fixed content" />
      </ErrorBoundary>
    );

    // Step 3: Click "Reintentar" — resets state to hasError: false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    // Step 4: The non-throwing children should now render
    expect(screen.getByText('Fixed content')).toBeInTheDocument();
    // Fallback must be gone
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
  });

  it('handles consecutive crash-after-retry gracefully', () => {
    render(
      <ErrorBoundary viewName="TestView">
        <ThrowChild shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();

    // Click reintentar
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    // If it crashes again, fallback reappears
    // We can't easily re-throw in the same render tree, but the state reset
    // is proven by the previous test. This test verifies the initial catch.
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    // After reset + potential rethrow, fallback should still render
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });

  it('renders normal children when hasError is false', () => {
    render(
      <ErrorBoundary viewName="EditorView">
        <ThrowChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Normal child')).toBeInTheDocument();
    // Fallback must not appear
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
  });
});
