
import React from 'react';
import { SavedPrompt } from '../types';
import { FusionLab } from '../components/FusionLab';

interface FusionViewProps {
  savedPrompts: SavedPrompt[];
  onSavePrompt: (prompt: SavedPrompt) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  setGlobalLoader: (state: { active: boolean; message: string }) => void;
}

const FusionView: React.FC<FusionViewProps> = ({ savedPrompts, onSavePrompt, addToast, setGlobalLoader }) => (
  <div className="animate-fade-slide-in-up">
    <FusionLab
      savedPrompts={savedPrompts}
      onSavePrompt={onSavePrompt}
      addToast={addToast}
      setGlobalLoader={setGlobalLoader}
    />
  </div>
);

export default FusionView;
