import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';

// --- Context mock helpers ---
let mockView = 'gallery';
let mockIsApiKeySet = true;

function buildMockContext() {
  return {
    view: mockView,
    setView: vi.fn(),
    toasts: [],
    addToast: vi.fn(),
    removeToast: vi.fn(),
    globalLoader: { active: false, message: '' },
    setGlobalLoader: vi.fn(),
    isApiKeySet: mockIsApiKeySet,
    pendingSharedPrompt: null,
    handleKeySaved: vi.fn(),
    savedPrompts: [],
    addPromptToGallery: vi.fn(),
    handleDeletePrompt: vi.fn(),
    handleUpdatePrompts: vi.fn(),
    importSharedPrompt: vi.fn(),
    handleSetView: vi.fn((v: string) => { mockView = v; }),
    promptForEditor: null,
    setPromptForEditor: vi.fn(),
    promptForPlayground: null,
    setPromptForPlayground: vi.fn(),
    promptToShare: null,
    setPromptToShare: vi.fn(),
    shareUrl: '',
    shareCardRef: { current: null },
    handleSharePrompt: vi.fn(),
    selectedPromptForModal: null,
    setSelectedPromptForModal: vi.fn(),
    handleSelectPromptForModal: vi.fn(),
    handleClosePromptModal: vi.fn(),
    handleEditPrompt: vi.fn(),
    isSettingsModalOpen: false,
    setIsSettingsModalOpen: vi.fn(),
    isWalkthroughActive: false,
    setIsWalkthroughActive: vi.fn(),
    finishWalkthrough: vi.fn(),
  };
}

// --- Mock all views ---
// ExtractorView with throwable for ErrorBoundary tests
let shouldExtractorThrow = false;
vi.mock('../../views/ExtractorView', () => ({
  default: () => {
    if (shouldExtractorThrow) throw new Error('Extractor crashed');
    return <div data-testid="view-extractor">Extractor</div>;
  },
}));

let shouldGalleryThrow = false;
vi.mock('../../views/GalleryView', () => ({
  default: () => {
    if (shouldGalleryThrow) throw new Error('Gallery crashed');
    return <div data-testid="view-gallery">Gallery</div>;
  },
}));

let shouldEditorThrow = false;
vi.mock('../../views/EditorView', () => ({
  default: () => {
    if (shouldEditorThrow) throw new Error('Editor crashed');
    return <div data-testid="view-editor">Editor</div>;
  },
}));

vi.mock('../../views/PlaygroundView', () => ({
  default: () => <div data-testid="view-playground">Playground</div>,
}));

vi.mock('../../views/FusionView', () => ({
  default: () => <div data-testid="view-fusion">Fusion</div>,
}));

// --- Mock context (use vi.fn so we can override) ---
vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn(() => buildMockContext()),
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Mock remaining components imported by App ---
vi.mock('../../components/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock('../../components/Loader', () => ({
  Loader: () => <div data-testid="loader">Loading...</div>,
}));

vi.mock('../../components/Toast', () => ({
  Toast: () => null,
}));

vi.mock('../../components/ShareCard', () => ({
  ShareCard: () => null,
}));

vi.mock('../../components/PromptModal', () => ({
  PromptModal: () => null,
}));

vi.mock('../../components/SettingsModal', () => ({
  SettingsModal: () => null,
}));

vi.mock('../../components/WalkthroughGuide', () => ({
  WalkthroughGuide: () => null,
}));

vi.mock('../../components/ApiKeySetup', () => ({
  ApiKeySetup: () => <div data-testid="api-key-setup">API Key Setup</div>,
}));

// Suppress console.error during ErrorBoundary tests (React logs caught errors)
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('App — ErrorBoundary wrapping (T3)', () => {
  beforeEach(() => {
    mockView = 'gallery';
    mockIsApiKeySet = true;
    shouldExtractorThrow = false;
    shouldGalleryThrow = false;
    shouldEditorThrow = false;
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('shows fallback when Extractor crashes and ErrorBoundary catches it', () => {
    mockView = 'extractor';
    shouldExtractorThrow = true;
    render(<App />);
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('shows fallback when Gallery crashes and ErrorBoundary catches it', async () => {
    mockView = 'gallery';
    shouldGalleryThrow = true;
    render(<App />);
    // Lazy component resolves asynchronously; wait for ErrorBoundary fallback
    await waitFor(() => {
      expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    });
  });

  it('shows fallback when Editor crashes and ErrorBoundary catches it', () => {
    mockView = 'editor';
    shouldEditorThrow = true;
    render(<App />);
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });

  it('renders view content when no error occurs', () => {
    mockView = 'extractor';
    render(<App />);
    expect(screen.getByTestId('view-extractor')).toBeInTheDocument();
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
  });

  it('crashed view fallback does NOT affect other views on navigation', () => {
    // Start with Extractor that crashes
    mockView = 'extractor';
    shouldExtractorThrow = true;
    const { rerender } = render(<App />);
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();

    // Navigate to editor (no crash) — editor should render fine
    mockView = 'editor';
    shouldExtractorThrow = false;
    rerender(<App />);
    expect(screen.getByTestId('view-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('view-extractor')).not.toBeInTheDocument();
  });

  it('shows API key setup when isApiKeySet is false', () => {
    mockIsApiKeySet = false;
    render(<App />);
    expect(screen.getByTestId('api-key-setup')).toBeInTheDocument();
  });
});

describe('App — Lazy loading GalleryView (T4)', () => {
  beforeEach(() => {
    mockView = 'gallery';
    mockIsApiKeySet = true;
    shouldGalleryThrow = false;
    vi.clearAllMocks();
  });

  it('renders GalleryView successfully when view=gallery', async () => {
    render(<App />);
    // Lazy component resolves asynchronously
    await waitFor(() => {
      expect(screen.getByTestId('view-gallery')).toBeInTheDocument();
    });
  });

  it('does NOT impact eager loading of other views', () => {
    mockView = 'editor';
    render(<App />);
    expect(screen.getByTestId('view-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('view-gallery')).not.toBeInTheDocument();
  });
});
