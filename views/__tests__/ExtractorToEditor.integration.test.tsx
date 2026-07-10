import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../../App';

// --- Reactive mock state for view-based rendering ---
// These module-level variables let us simulate navigation by re-rendering with updated state.
let mockView: string = 'extractor';
let mockPromptForEditor: object | null = null;

// Stable mock refs so we can assert on calls across re-renders
const mockSetPromptForEditor = vi.fn((p: object) => {
  mockPromptForEditor = p;
});
const mockHandleSetView = vi.fn((v: string) => {
  mockView = v;
});

function buildMockContext() {
  return {
    view: mockView,
    setView: vi.fn(),
    toasts: [],
    addToast: vi.fn(),
    removeToast: vi.fn(),
    globalLoader: { active: false, message: '' },
    setGlobalLoader: vi.fn(),
    isApiKeySet: true,
    pendingSharedPrompt: null,
    handleKeySaved: vi.fn(),
    savedPrompts: [],
    addPromptToGallery: vi.fn(),
    handleDeletePrompt: vi.fn(),
    handleUpdatePrompts: vi.fn(),
    importSharedPrompt: vi.fn(),
    handleSetView: mockHandleSetView,
    promptForEditor: mockPromptForEditor,
    setPromptForEditor: mockSetPromptForEditor,
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

// --- Module-level mocks ---

vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn(() => buildMockContext()),
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Gemini services at the module boundary — the core of this integration test
vi.mock('../../services/gemini', () => ({
  analyzeImageFeature: vi.fn(),
  generateFeatureMetadata: vi.fn(),
  generateIdeasForStyle: vi.fn(),
}));

// Mock UI chrome that isn't part of the Extractor→Editor flow
vi.mock('../../components/Toast', () => ({ Toast: () => null }));
vi.mock('../../components/ShareCard', () => ({ ShareCard: () => null }));
vi.mock('../../components/PromptModal', () => ({ PromptModal: () => null }));
vi.mock('../../components/SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('../../components/WalkthroughGuide', () => ({ WalkthroughGuide: () => null }));
vi.mock('../../components/ApiKeySetup', () => ({
  ApiKeySetup: () => <div data-testid="api-key-setup">API Key Setup</div>,
}));

// NOTE: ExtractorView, EditorView, ImageUploader, PromptDisplay, Header,
// ExtractorModeSelector, and Loader are NOT mocked — we test the real components.

// Polyfill document.fonts.ready for ExtractorModeSelector's useLayoutEffect
// (jsdom does not implement FontFaceSet.ready)
if (typeof document !== 'undefined' && typeof document.fonts === 'undefined') {
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve() },
    configurable: true,
    writable: true,
  });
}

describe('ExtractorToEditor — integration', () => {
  beforeEach(() => {
    mockView = 'extractor';
    mockPromptForEditor = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it(
    'uploads an image, analyzes it, and navigates to editor with the extracted prompt',
    async () => {
      // --- Arrange ---
      const MOCK_EXTRACTED_PROMPT =
        'A serene digital painting of a mountain landscape at sunset with vibrant colors, soft brushstrokes';

      // Import the mocked analyzeImageFeature and configure its return value
      const { analyzeImageFeature } = await import('../../services/gemini');
      vi.mocked(analyzeImageFeature).mockResolvedValue({ result: MOCK_EXTRACTED_PROMPT });

      // --- Act: Render App starting at Extractor view ---
      const { container, rerender } = render(<App />);

      // 1. Upload a mock image
      const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).not.toBeNull();

      const testFile = new File(['dummy-image-content'], 'test-image.png', { type: 'image/png' });
      fireEvent.change(fileInput!, { target: { files: [testFile] } });

      // Wait for FileReader to process and render the image preview
      await waitFor(() => {
        expect(screen.getByAltText(/Preview 1/i)).toBeInTheDocument();
      });

      // 2. Click "Analizar" button
      const analyzeButton = screen.getByRole('button', { name: /analizar/i });
      expect(analyzeButton).not.toBeDisabled();
      fireEvent.click(analyzeButton);

      // 3. Wait for analysis result text to appear
      await waitFor(() => {
        expect(screen.getByText(MOCK_EXTRACTED_PROMPT)).toBeInTheDocument();
      });

      // 4. Verify analyzeImageFeature was called with the right parameters
      expect(vi.mocked(analyzeImageFeature)).toHaveBeenCalledWith(
        'style',
        expect.arrayContaining([
          expect.objectContaining({
            imageBase64: expect.any(String),
            mimeType: 'image/png',
          }),
        ]),
      );

      // 5. Find and click "Usar Estilo en Editor"
      const useInEditorButton = screen.getByRole('button', { name: /Usar Estilo en Editor/i });
      expect(useInEditorButton).toBeInTheDocument();
      fireEvent.click(useInEditorButton);

      // 6. Re-render to pick up the mockHandleSetView update (mockView → 'editor')
      rerender(<App />);

      // --- Assert ---

      // The view switched to 'editor' — EditorView should render with its heading
      await waitFor(() => {
        expect(screen.getByText('Editor Modular')).toBeInTheDocument();
      });

      // Navigation callback was invoked with 'editor'
      expect(mockHandleSetView).toHaveBeenCalledWith('editor');

      // The extracted prompt was forwarded to the editor via setPromptForEditor
      expect(mockSetPromptForEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: MOCK_EXTRACTED_PROMPT,
          title: 'Nuevo Fragmento desde Extractor',
          type: 'style',
        }),
      );

      // Extractor-specific UI is gone after navigation
      expect(screen.queryByText(/Analizar Estilo/i)).not.toBeInTheDocument();
    },
    15000,
  );
});
