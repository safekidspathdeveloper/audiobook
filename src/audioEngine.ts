/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicIntervalId: number | null = null;
  private currentMusicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private customMusicAudio: HTMLAudioElement | null = null;
  private customVoiceAudio: HTMLAudioElement | null = null;
  public musicVolume: number = 0.25; // 0 to 1
  public effectsVolume: number = 0.5; // 0 to 1

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play a simple high quality chime
  public playChime() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    
    notes.forEach((freq, index) => {
      const time = now + index * 0.08;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.15 * this.effectsVolume, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.7);
    });
  }

  // Play a cute bubble pop sound effect
  public playBubble() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frequency sweeps rapidly upward to mimic bubble popping
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);

    gain.gain.setValueAtTime(this.effectsVolume * 0.35, now);
    gain.gain.setValueAtTime(this.effectsVolume * 0.35, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Play a bouncy spring "boing" sound effect
  public playBoing() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    // Rapidly modulate frequency up and down
    osc.frequency.linearRampToValueAtTime(320, now + 0.08);
    osc.frequency.linearRampToValueAtTime(160, now + 0.16);
    osc.frequency.linearRampToValueAtTime(260, now + 0.24);
    osc.frequency.linearRampToValueAtTime(100, now + 0.35);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.effectsVolume * 0.4, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Play magic fairy glitter sweep
  public playMagicSparkle() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const maxChords = 8;
    // Rapid sparkly random chime notes pentatonic scale
    const pentatonic = [587.33, 659.25, 783.99, 880.00, 987.77, 1174.66, 1318.51];
    
    for (let i = 0; i < maxChords; i++) {
      const time = now + i * 0.05;
      const note = pentatonic[Math.floor(Math.random() * pentatonic.length)];
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.12 * this.effectsVolume, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.4);
    }
  }

  // Play laser cartoon beam
  public playZing() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);

    gain.gain.setValueAtTime(this.effectsVolume * 0.15, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  // Start continuous soft ambient background music
  public startBackgroundMusic(genre: 'forest' | 'lullaby' | 'bubbles' | 'dance' | 'beach' | 'squirrel', customMusicUrl?: string) {
    this.stopBackgroundMusic();

    if (customMusicUrl) {
      try {
        this.customMusicAudio = new Audio(customMusicUrl);
        this.customMusicAudio.loop = true;
        this.customMusicAudio.volume = this.musicVolume;
        this.customMusicAudio.play().catch(e => console.log("Custom MP3 background play prevented:", e));
      } catch (e) {
        console.error("Failed to load custom background music MP3:", e);
      }
      return;
    }

    const ctx = this.initCtx();
    if (!ctx) return;

    let baseNotes = [261.63, 329.63, 392.00, 440.00]; // C, E, G, A
    let oscType: OscillatorType = 'sine';
    let speed = 2000; // ms per chord

    if (genre === 'lullaby') {
      baseNotes = [293.66, 349.23, 440.00, 523.25]; // D, F, A, C
      oscType = 'sine';
      speed = 2400;
    } else if (genre === 'bubbles') {
      baseNotes = [311.13, 349.23, 415.30, 466.16]; // Eb, F, Ab, Bb
      speed = 1800;
    } else if (genre === 'forest' || genre === 'squirrel') {
      baseNotes = [261.63, 293.66, 329.63, 392.00]; // Pentatonic C
      oscType = 'sine';
      speed = 2200;
    } else if (genre === 'dance') {
      baseNotes = [329.63, 392.00, 440.00, 523.25]; // Playful C Am
      oscType = 'triangle';
      speed = 1500;
    } else if (genre === 'beach') {
      baseNotes = [261.63, 349.23, 392.00, 523.25]; // F, G, C
      oscType = 'sine';
      speed = 2500;
    }

    const playChord = () => {
      if (!ctx || ctx.state === 'suspended') return;
      const now = ctx.currentTime;
      
      // Shuffle notes gently
      const activeNotes = [...baseNotes].sort(() => 0.5 - Math.random()).slice(0, 3);
      
      activeNotes.forEach((freq, idx) => {
        // Minor timing offsets to sound natural (arpeggiated strum)
        const noteTime = now + idx * 0.15;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = oscType;
        // Slightly detune to sound warmer and organic
        osc.frequency.setValueAtTime(freq + (Math.random() * 4 - 2), noteTime);
        
        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(this.musicVolume * 0.08, noteTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + (speed / 1000) * 1.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(noteTime);
        osc.stop(noteTime + (speed / 1000) * 1.6);
        
        const nodeRef = { osc, gain };
        this.currentMusicNodes.push(nodeRef);
        
        // Clean up node array when finished playing
        setTimeout(() => {
          this.currentMusicNodes = this.currentMusicNodes.filter(n => n !== nodeRef);
        }, speed * 2);
      });
    };

    // Play first chord immediately
    playChord();
    
    // Set looping interval
    this.musicIntervalId = window.setInterval(playChord, speed);
  }

  public stopBackgroundMusic() {
    if (this.customMusicAudio) {
      try {
        this.customMusicAudio.pause();
      } catch (e) {}
      this.customMusicAudio = null;
    }

    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    
    this.currentMusicNodes.forEach(({ osc, gain }) => {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    this.currentMusicNodes = [];
  }

  // Speech helper using Synthesis
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  public getCustomVoiceAudio(): HTMLAudioElement | null {
    return this.customVoiceAudio;
  }

  public speak(
    text: string,
    options: {
      pitch: number; // 0.5 to 2 (kid level defaults around 1.3 for cuteness)
      rate: number;  // 0.5 to 2
      volume: number; // 0 to 1
      customVoiceUrl?: string; // Optional custom voice track URL
    },
    onWordBoundary: (charIndex: number, charLength: number, text: string) => void,
    onEnded: () => void
  ) {
    this.stopSpeaking();

    if (options.customVoiceUrl) {
      try {
        this.customVoiceAudio = new Audio(options.customVoiceUrl);
        this.customVoiceAudio.volume = options.volume;
        this.customVoiceAudio.onended = () => {
          this.customVoiceAudio = null;
          onEnded();
        };
        this.customVoiceAudio.onerror = () => {
          this.customVoiceAudio = null;
          onEnded();
        };
        this.customVoiceAudio.play().catch(err => {
          console.log("Custom voice playing blocked or error:", err);
          onEnded();
        });
      } catch (e) {
        console.error("Error setting custom narrative voice:", e);
        onEnded();
      }
      return;
    }

    // Check compatibility
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      // Fallback timer if SpeechSynthesis is not supported
      setTimeout(onEnded, text.split(' ').length * 400); // 400ms per word approximation
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to pick a soft friendly English voice
    const voices = window.speechSynthesis.getVoices();
    // Try to find a nice female / kid-friendly voice if available
    let friendlyVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('google'));
    if (!friendlyVoice) {
      friendlyVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('soft'));
    }
    if (!friendlyVoice) {
      friendlyVoice = voices.find(v => v.lang.startsWith('en'));
    }
    if (friendlyVoice) {
      utterance.voice = friendlyVoice;
    }

    utterance.pitch = options.pitch;
    utterance.rate = options.rate;
    utterance.volume = options.volume;

    // Track active word highlight boundaries
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Calculate word length
        const charIndex = event.charIndex;
        const sub = text.substring(charIndex);
        const match = sub.match(/^[\w']+/);
        const length = match ? match[0].length : 5;
        onWordBoundary(charIndex, length, text);
      }
    };

    utterance.onend = () => {
      if (this.currentUtterance === utterance) {
        onEnded();
      }
    };

    utterance.onerror = () => {
      if (this.currentUtterance === utterance) {
        onEnded();
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (this.customVoiceAudio) {
      try {
        this.customVoiceAudio.pause();
      } catch (e) {}
      this.customVoiceAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  public pauseSpeaking() {
    if (this.customVoiceAudio) {
      try {
        this.customVoiceAudio.pause();
      } catch (e) {}
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
  }

  public resumeSpeaking() {
    if (this.customVoiceAudio) {
      try {
        this.customVoiceAudio.play().catch(e => console.log("Failed to resume custom voice:", e));
      } catch (e) {}
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  }

  // Update dynamic values mid-play
  public setVolumes(musicVal: number, fxVal: number) {
    this.musicVolume = musicVal;
    this.effectsVolume = fxVal;
    if (this.customMusicAudio) {
      this.customMusicAudio.volume = musicVal;
    }
    if (this.customVoiceAudio) {
      this.customVoiceAudio.volume = fxVal;
    }
  }
}

// Single persistent instance
export const audio = new AudioEngine();
