import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackApiCall } from '../config';

describe('trackApiCall', () => {
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs all values in a structured console group', () => {
    trackApiCall({
      model: 'models/gemini-2.0-flash-exp',
      promptTokens: 150,
      responseTokens: 45,
      latencyMs: 320,
    });

    expect(consoleGroupSpy).toHaveBeenCalledWith('[Gemini API] models/gemini-2.0-flash-exp');
    expect(consoleLogSpy).toHaveBeenCalledWith('Prompt Tokens: 150');
    expect(consoleLogSpy).toHaveBeenCalledWith('Response Tokens: 45');
    expect(consoleLogSpy).toHaveBeenCalledWith('Total Tokens: 195');
    expect(consoleLogSpy).toHaveBeenCalledWith('Latency: 320ms');
    expect(consoleGroupEndSpy).toHaveBeenCalled();
  });

  it('logs "N/A" for null promptTokens and responseTokens', () => {
    trackApiCall({
      model: 'models/gemini-2.0-flash-exp',
      promptTokens: null as unknown as number,
      responseTokens: null as unknown as number,
      latencyMs: 100,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith('Prompt Tokens: N/A');
    expect(consoleLogSpy).toHaveBeenCalledWith('Response Tokens: N/A');
    expect(consoleLogSpy).toHaveBeenCalledWith('Total Tokens: 0');
    expect(consoleLogSpy).toHaveBeenCalledWith('Latency: 100ms');
  });

  it('logs "N/A" for undefined promptTokens and responseTokens', () => {
    trackApiCall({
      model: 'models/gemini-2.5-flash',
      promptTokens: undefined as unknown as number,
      responseTokens: undefined as unknown as number,
      latencyMs: 200,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith('Prompt Tokens: N/A');
    expect(consoleLogSpy).toHaveBeenCalledWith('Response Tokens: N/A');
    expect(consoleLogSpy).toHaveBeenCalledWith('Total Tokens: 0');
    expect(consoleLogSpy).toHaveBeenCalledWith('Latency: 200ms');
  });

  it('uses latencyMs as-is when provided', () => {
    trackApiCall({
      model: 'models/gemini-3-flash-preview',
      promptTokens: 10,
      responseTokens: 5,
      latencyMs: 0,
    });

    expect(consoleLogSpy).toHaveBeenCalledWith('Latency: 0ms');
  });

  it('does not throw when called with valid params', () => {
    expect(() =>
      trackApiCall({
        model: 'models/gemini-2.0-flash-exp',
        promptTokens: 100,
        responseTokens: 50,
        latencyMs: 250,
      })
    ).not.toThrow();
  });

  it('does not throw when called with null values', () => {
    expect(() =>
      trackApiCall({
        model: 'models/gemini-2.0-flash-exp',
        promptTokens: null as unknown as number,
        responseTokens: null as unknown as number,
        latencyMs: null as unknown as number,
      })
    ).not.toThrow();
  });

  it('does not throw when called with undefined values', () => {
    expect(() =>
      trackApiCall({
        model: 'models/gemini-2.0-flash-exp',
        promptTokens: undefined as unknown as number,
        responseTokens: undefined as unknown as number,
        latencyMs: undefined as unknown as number,
      })
    ).not.toThrow();
  });
});
