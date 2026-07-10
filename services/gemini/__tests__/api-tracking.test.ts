import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock the config module so we can spy on trackApiCall and getAiClient ---
const mockTrackApiCall = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock('../config', async () => {
  const actual = await vi.importActual('../config');
  return {
    ...actual,
    trackApiCall: mockTrackApiCall,
    getAiClient: () => ({
      models: {
        generateContent: mockGenerateContent,
      },
    }),
  };
});

const BASE_RESPONSE = {
  text: 'mocked response',
  usageMetadata: {
    promptTokenCount: 42,
    candidatesTokenCount: 13,
  },
};

describe('API Tracking — service files call trackApiCall after generateContent', () => {
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockResolvedValue(BASE_RESPONSE);
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- imageService.ts (2 call sites) ---
  describe('imageService.ts', () => {
    it('generateImageFromPrompt calls trackApiCall with correct model and tokens', async () => {
      const { generateImageFromPrompt } = await import('../imageService');
      mockGenerateContent.mockResolvedValue({
        ...BASE_RESPONSE,
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'abc' } }] } }],
      });
      await generateImageFromPrompt('a cat');
      expect(mockTrackApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash-image',
          promptTokens: 42,
          responseTokens: 13,
        })
      );
    });

    it('analyzeImageFeature calls trackApiCall with correct model and tokens', async () => {
      const { analyzeImageFeature } = await import('../imageService');
      await analyzeImageFeature('style', [{ imageBase64: 'abc', mimeType: 'image/png' }]);
      expect(mockTrackApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-flash-preview',
          promptTokens: 42,
          responseTokens: 13,
        })
      );
    });
  });

  // --- textService.ts (5 call sites) ---
  describe('textService.ts', () => {
    it('modularizePrompt calls trackApiCall with correct model', async () => {
      const { modularizePrompt } = await import('../textService');
      mockGenerateContent.mockResolvedValue({ ...BASE_RESPONSE, text: '{}' });
      await modularizePrompt('test prompt');
      expect(mockTrackApiCall).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3-flash-preview' })
      );
    });

    it('assembleMasterPrompt calls trackApiCall with correct model', async () => {
      const { assembleMasterPrompt } = await import('../textService');
      mockGenerateContent.mockResolvedValue({ ...BASE_RESPONSE, text: 'master prompt' });
      await assembleMasterPrompt({ style: 'test' });
      expect(mockTrackApiCall).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-2.5-flash' })
      );
    });
  });

  // --- structureService.ts (6 call sites) ---
  describe('structureService.ts', () => {
    it('assembleOptimizedJson calls trackApiCall', async () => {
      const { assembleOptimizedJson } = await import('../structureService');
      mockGenerateContent.mockResolvedValue({ ...BASE_RESPONSE, text: '{}' });
      await assembleOptimizedJson({ style: 'test' });
      expect(mockTrackApiCall).toHaveBeenCalled();
    });

    it('generateStructuredPromptFromImage calls trackApiCall', async () => {
      const { generateStructuredPromptFromImage } = await import('../structureService');
      mockGenerateContent.mockResolvedValue({ ...BASE_RESPONSE, text: '{}' });
      await generateStructuredPromptFromImage([{ imageBase64: 'abc', mimeType: 'image/png' }]);
      expect(mockTrackApiCall).toHaveBeenCalled();
    });
  });

  // --- metadataService.ts (1 direct call site + 2 wrappers that delegate) ---
  describe('metadataService.ts', () => {
    it('generateFeatureMetadata calls trackApiCall', async () => {
      const { generateFeatureMetadata } = await import('../metadataService');
      mockGenerateContent.mockResolvedValue({ ...BASE_RESPONSE, text: '{}' });
      await generateFeatureMetadata('style', 'test prompt');
      expect(mockTrackApiCall).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3-flash-preview' })
      );
    });

    it('generateIdeasForStyle calls trackApiCall', async () => {
      const { generateIdeasForStyle } = await import('../metadataService');
      mockGenerateContent.mockResolvedValue({ ...BASE_RESPONSE, text: '[]' });
      await generateIdeasForStyle('a style');
      expect(mockTrackApiCall).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3-flash-preview' })
      );
    });
  });

  // --- assistantService.ts (2 call sites) ---
  describe('assistantService.ts', () => {
    it('getCreativeAssistantResponse calls trackApiCall', async () => {
      const { getCreativeAssistantResponse } = await import('../assistantService');
      mockGenerateContent.mockResolvedValue({ ...BASE_RESPONSE, text: '{}' });
      await getCreativeAssistantResponse([], {});
      expect(mockTrackApiCall).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3-flash-preview' })
      );
    });

    it('generateHybridFragment calls trackApiCall', async () => {
      const { generateHybridFragment } = await import('../assistantService');
      mockGenerateContent.mockResolvedValue({ ...BASE_RESPONSE, text: 'hybrid result' });
      await generateHybridFragment('style', [{ text: 'input 1' }], 'user feedback');
      expect(mockTrackApiCall).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3-flash-preview' })
      );
    });
  });

  it('handles concurrent calls without throwing', async () => {
    const { analyzeImageFeature } = await import('../imageService');
    mockGenerateContent.mockResolvedValue(BASE_RESPONSE);
    await Promise.all([
      analyzeImageFeature('style', [{ imageBase64: 'a', mimeType: 'image/png' }]),
      analyzeImageFeature('subject', [{ imageBase64: 'b', mimeType: 'image/png' }]),
    ]);
    expect(mockTrackApiCall).toHaveBeenCalledTimes(2);
  });
});
