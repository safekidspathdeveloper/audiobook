/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Story {
  id: string;
  title: string;
  sub: string;
  emoji: string;
  cover: string;
  color: string;           // primary background color (e.g., bg-amber-200)
  buttonColor: string;     // the popping button background color (e.g., bg-amber-300, bg-sky-300)
  accentColor: string;     // text or accent border color (e.g., text-amber-900)
  author: string;
  character: string;       // name of the main interactive character
  soundPreset: 'forest' | 'lullaby' | 'bubbles' | 'dance' | 'beach' | 'squirrel';
  pages: string[];         // paragraphs of the story narration
  customMusicUrl?: string; // custom MP3 background track URL or local asset path
  customVoiceUrl?: string; // custom MP3 narration track URL or local asset path
}

export interface SoundEffect {
  id: string;
  name: string;
  emoji: string;
  type: 'chime' | 'laser' | 'bubble' | 'boing' | 'magic';
}
