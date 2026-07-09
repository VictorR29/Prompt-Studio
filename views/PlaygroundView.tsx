
import React from 'react';
import { SavedPrompt } from '../types';
import { Playground } from '../components/Playground';

interface PlaygroundViewProps {
  initialPrompt: SavedPrompt | null;
  savedPrompts: SavedPrompt[];
  onSavePrompt: (prompt: SavedPrompt) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  setGlobalLoader: (state: { active: boolean; message: string }) => void;
}

const PlaygroundView: React.FC<PlaygroundViewProps> = ({ initialPrompt, savedPrompts, onSavePrompt, addToast, setGlobalLoader }) => (
  <div className="animate-fade-slide-in-up">
    <Playground
      initialPrompt={initialPrompt}
      savedPrompts={savedPrompts}
      onSavePrompt={onSavePrompt}
      addToast={addToast}
      setGlobalLoader={setGlobalLoader}
    />
  </div>
);

export default PlaygroundView;
