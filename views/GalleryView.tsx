
import React from 'react';
import { SavedPrompt } from '../types';
import { Gallery } from '../components/Gallery';

interface GalleryViewProps {
  prompts: SavedPrompt[];
  onSelect: (prompt: SavedPrompt) => void;
  onDelete: (id: string) => void;
  onEdit: (prompt: SavedPrompt) => void;
  onShare: (prompt: SavedPrompt) => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({ prompts, onSelect, onDelete, onEdit, onShare }) => (
  <div className="animate-fade-slide-in-up">
    <Gallery prompts={prompts} onSelect={onSelect} onDelete={onDelete} onEdit={onEdit} onShare={onShare} />
  </div>
);

export default GalleryView;
