/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  X, 
  Volume2, 
  VolumeX, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Settings, 
  Music, 
  BookOpen, 
  Clock, 
  Heart, 
  Baby, 
  User, 
  Award, 
  RefreshCw,
  Info,
  Mail,
  Send,
  LogOut,
  Inbox
} from 'lucide-react';
import { stories } from './storiesData';
import { audio } from './audioEngine';
import { Story } from './types';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  sendGmailEmail, 
  fetchRecentEmails 
} from './gmailService';
import { User as FirebaseUser } from 'firebase/auth';

export default function App() {
  // Stories state loaded from localStorage or default stories list
  const [storiesList, setStoriesList] = useState<Story[]>(() => {
    localStorage.removeItem('story_kids_custom_stories');
    return stories;
  });

  // Developer Image Editor states
  const [activeTab, setActiveTab] = useState<'cozy' | 'editor' | 'gmail'>('cozy');

  // Gmail & OAuth states
  const [gmailUser, setGmailUser] = useState<FirebaseUser | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState<boolean>(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailPersonalMessage, setEmailPersonalMessage] = useState<string>('');
  const [emailSending, setEmailSending] = useState<boolean>(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState<boolean>(false);
  const [gmailStoryToEmail, setGmailStoryToEmail] = useState<Story | null>(null);
  const [editingStoryId, setEditingStoryId] = useState<string>(stories[0].id);
  const [editingImageUrl, setEditingImageUrl] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [editingSub, setEditingSub] = useState<string>('');
  const [editingCharacter, setEditingCharacter] = useState<string>('');
  const [editingAuthor, setEditingAuthor] = useState<string>('');
  const [editingMusicUrl, setEditingMusicUrl] = useState<string>('');
  const [editingVoiceUrl, setEditingVoiceUrl] = useState<string>('');
  const [editingPagesText, setEditingPagesText] = useState<string>('');

  // App navigation state
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(0.25);
  const [voiceVolume, setVoiceVolume] = useState<number>(0.8);
  const [voicePitch, setVoicePitch] = useState<number>(1.2); // Cozy slightly high pitch
  const [voiceRate, setVoiceRate] = useState<number>(0.85); // Gentle slow pacing for child-friendly listening
  const [bgMusicOn, setBgMusicOn] = useState<boolean>(true);
  
  // Word Highlighting Speech State
  const [spokenText, setSpokenText] = useState<string>('');
  const [highlitWordIdx, setHighlitWordIdx] = useState<number>(-1);
  const [highlitWordLen, setHighlitWordLen] = useState<number>(0);

  // Parent dashboard state
  const [isParentModalOpen, setIsParentModalOpen] = useState<boolean>(false);
  const [parentGateAnswer, setParentGateAnswer] = useState<string>('');
  const [parentGateError, setParentGateError] = useState<boolean>(false);
  const [parentGateQuestion, setParentGateQuestion] = useState<{ q: string; a: number }>({ q: '', a: 0 });
  const [isParentUnlocked, setIsParentUnlocked] = useState<boolean>(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepSecondsRemaining, setSleepSecondsRemaining] = useState<number | null>(null);
  
  // Child gamification/stats state
  const [storiesListenedCount, setStoriesListenedCount] = useState<number>(() => {
    return Number(localStorage.getItem('story_kids_listened_count') || '0');
  });
  const [bubblePopScore, setBubblePopScore] = useState<number>(() => {
    return Number(localStorage.getItem('story_kids_bubble_score') || '0');
  });

  // Generate background floating bubbles
  const [bgBubbles, setBgBubbles] = useState<{ id: number; left: number; size: number; delay: number; speed: number; char: string }[]>([]);

  // Ref for sleeping timer
  const timerInstanceRef = useRef<number | null>(null);

  // Ref to container of scrollable transcript
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  // Synchronize elapsed time for scrolling long custom transcripts
  const [customAudioTime, setCustomAudioTime] = useState<number>(0);
  const [customAudioDuration, setCustomAudioDuration] = useState<number>(0);

  // Get timestamps for each page in the custom narration based on character lengths
  const getPageTimestamps = () => {
    if (!activeStory || !activeStory.customVoiceUrl || customAudioDuration <= 0) {
      return [];
    }
    
    // 10.5 seconds for built-in magic-forest ("I Trust What I Feel") or a 2.0s standard intro delay
    const intro = activeStory.id === 'magic-forest' ? 10.5 : 2.0; 
    const outro = 2.0;
    const availableDuration = Math.max(0.5, customAudioDuration - intro - outro);
    
    const pages = activeStory.pages;
    const lengths = pages.map(p => p.length);
    const totalLength = lengths.reduce((sum, len) => sum + len, 0) || 1;
    
    let currentStart = intro;
    return pages.map((pageText, idx) => {
      const pageWeight = pageText.length / totalLength;
      const pageDuration = availableDuration * pageWeight;
      const start = currentStart;
      const end = currentStart + pageDuration;
      currentStart = end;
      return { start, end };
    });
  };

  // Poll progress of the custom voice MP3 track
  useEffect(() => {
    let interval: any;
    if (activeStory && activeStory.customVoiceUrl && isPlaying && !isPaused) {
      interval = setInterval(() => {
        const audioEl = audio.getCustomVoiceAudio();
        if (audioEl) {
          setCustomAudioTime(audioEl.currentTime);
          setCustomAudioDuration(audioEl.duration || 1);
        }
      }, 100);
    } else {
      if (!isPaused) {
        setCustomAudioTime(0);
        setCustomAudioDuration(0);
      }
    }
    return () => clearInterval(interval);
  }, [activeStory, isPlaying, isPaused]);

  // Map custom MP3 playhead to relevant paragraph page index
  useEffect(() => {
    if (activeStory && activeStory.customVoiceUrl && customAudioDuration > 0) {
      const timestamps = getPageTimestamps();
      if (timestamps.length > 0) {
        let matchedIdx = 0;
        for (let i = 0; i < timestamps.length; i++) {
          if (customAudioTime >= timestamps[i].start && customAudioTime <= timestamps[i].end) {
            matchedIdx = i;
            break;
          }
        }
        // Clamps for bounds
        if (customAudioTime < timestamps[0].start) {
          matchedIdx = 0;
        } else if (customAudioTime > timestamps[timestamps.length - 1].end) {
          matchedIdx = timestamps.length - 1;
        }
        
        if (matchedIdx !== currentPageIndex) {
          setCurrentPageIndex(matchedIdx);
        }
      }
    }
  }, [customAudioTime, customAudioDuration, activeStory, currentPageIndex]);

  // Simulate word highlighted tracking specifically for custom MP3 audios as they play
  useEffect(() => {
    if (activeStory && activeStory.customVoiceUrl && customAudioDuration > 0 && isPlaying && !isPaused) {
      const timestamps = getPageTimestamps();
      const currentTimestamps = timestamps[currentPageIndex];
      if (currentTimestamps) {
        const pageStart = currentTimestamps.start;
        const pageEnd = currentTimestamps.end;
        const pageDuration = pageEnd - pageStart;
        const elapsedOnPage = Math.max(0, customAudioTime - pageStart);
        const pageText = activeStory.pages[currentPageIndex];
        
        if (elapsedOnPage < pageDuration && pageText) {
          const ratio = elapsedOnPage / pageDuration;
          const charIndex = Math.min(pageText.length - 1, Math.floor(ratio * pageText.length));
          
          // Locate word boundary safely around computed charIndex position
          const startSpace = pageText.lastIndexOf(' ', charIndex);
          const nextSpace = pageText.indexOf(' ', charIndex);
          
          const startIdx = startSpace === -1 ? 0 : startSpace + 1;
          const endIdx = nextSpace === -1 ? pageText.length : nextSpace;
          
          // Clamp values to prevent index errors
          const finalStart = Math.max(0, startIdx);
          const finalLen = Math.max(1, endIdx - finalStart);
          
          setHighlitWordIdx(finalStart);
          setHighlitWordLen(finalLen);
          setSpokenText(pageText);
        } else {
          setHighlitWordIdx(-1);
          setHighlitWordLen(0);
        }
      }
    }
  }, [customAudioTime, currentPageIndex, activeStory, isPlaying, isPaused, customAudioDuration]);

  // Center the highlighted transcript paragraph smoothly in the text bubble
  useEffect(() => {
    if (transcriptContainerRef.current) {
      const container = transcriptContainerRef.current;
      const activeElement = container.querySelector(`[data-page-index="${currentPageIndex}"]`) as HTMLElement;
      if (activeElement) {
        const containerHeight = container.clientHeight;
        const elemTop = activeElement.offsetTop;
        const elemHeight = activeElement.clientHeight;
        const targetScrollTop = elemTop - (containerHeight / 2) + (elemHeight / 2);
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }
    }
  }, [currentPageIndex]);

  // Initialize background bubbles and set volumes on start
  useEffect(() => {
    const bubbleCharacters = ['🧼', '🎈', '🫧', '✨', '⭐', '🎈'];
    const generated = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: Math.random() * 90 + 5,
      size: Math.random() * 60 + 35,
      delay: Math.random() * 10,
      speed: Math.random() * 12 + 10,
      char: bubbleCharacters[i % bubbleCharacters.length],
    }));
    setBgBubbles(generated);
    audio.setVolumes(musicVolume, voiceVolume);
  }, []);

  // Update audio volume settings inside native synth
  useEffect(() => {
    audio.setVolumes(bgMusicOn ? musicVolume : 0, voiceVolume);
  }, [musicVolume, voiceVolume, bgMusicOn]);

  // Handle active countdown sleep timer
  useEffect(() => {
    if (sleepTimerMinutes !== null && sleepTimerMinutes > 0) {
      setSleepSecondsRemaining(sleepTimerMinutes * 60);
    } else {
      setSleepSecondsRemaining(null);
    }
  }, [sleepTimerMinutes]);

  useEffect(() => {
    if (sleepSecondsRemaining !== null) {
      if (sleepSecondsRemaining <= 0) {
        // Sleep timer triggered! Stop elements
        audio.stopSpeaking();
        audio.stopBackgroundMusic();
        setIsPlaying(false);
        setIsPaused(false);
        setSleepTimerMinutes(null);
        setSleepSecondsRemaining(null);
        audio.playChime(); // Gentle sound telling sleep mode has kicked in
      } else {
        const interval = setInterval(() => {
          setSleepSecondsRemaining(prev => (prev !== null ? prev - 1 : null));
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [sleepSecondsRemaining]);

  // Stop sound triggers on unmount
  useEffect(() => {
    return () => {
      audio.stopSpeaking();
      audio.stopBackgroundMusic();
    };
  }, []);

  // Synchronize Firebase Auth Google credentials and load Gmail logs
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGmailUser(user);
        setGmailToken(token);
        if (user.email) {
          setEmailTo(user.email);
        }
        loadRecentEmails(token);
      },
      () => {
        setGmailUser(null);
        setGmailToken(null);
      }
    );
    return () => unsubscribe && unsubscribe();
  }, []);

  const loadRecentEmails = async (token: string) => {
    try {
      const response = await fetchRecentEmails(token, 'subject:"Safe Kids Path"');
      setEmailLogs(response || []);
    } catch (err) {
      console.error('Failed to load recent emails:', err);
    }
  };

  const handleGmailSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGmailUser(res.user);
        setGmailToken(res.accessToken);
        if (res.user.email) {
          setEmailTo(res.user.email);
        }
        loadRecentEmails(res.accessToken);
      }
    } catch (err) {
      console.error('Sign in failed:', err);
    }
  };

  const handleGmailSignOut = async () => {
    try {
      await logout();
      setGmailUser(null);
      setGmailToken(null);
      setEmailLogs([]);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const handleSendStoryEmail = async (story: Story) => {
    if (!gmailToken) {
      handleGmailSignIn();
      return;
    }

    if (!emailTo) {
      alert('Please provide a valid recipient email address.');
      return;
    }

    setEmailSending(true);
    setEmailSentSuccess(false);

    try {
      const subject = `Safe Kids Path: Read "${story.title}" Together! ✨`;
      
      const bodyHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 4px solid #fed7aa; border-radius: 40px; background-color: #fffaf5; color: #334155;">
          <div style="text-align: center; margin-bottom: 20px;">
            <p style="font-size: 50px; margin: 0;">🧸</p>
            <h1 style="color: #ea580c; font-size: 28px; font-weight: 900; margin: 10px 0 5px 0;">Safe Kids Path Audio Books</h1>
            <p style="color: #c2410c; font-weight: bold; margin: 0; font-size: 14px;">A cozy story and audiobook castle for children & families</p>
          </div>
          
          <div style="background-color: #fff; border: 2px solid #ffedd5; border-radius: 24px; padding: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); margin-bottom: 20px;">
            <div style="text-align: center; margin-bottom: 15px;">
              <span style="font-size: 40px; display: block; margin-bottom: 5px;">${story.emoji}</span>
              <h2 style="color: #1e293b; font-size: 22px; font-weight: 900; margin: 0 0 5px 0;">${story.title}</h2>
              <p style="color: #64748b; font-style: italic; margin: 0; font-size: 14px;">${story.sub}</p>
              <p style="font-size: 13px; color: #475569; margin: 5px 0 0 0;"><strong>By ${story.author} feat. ${story.character}</strong></p>
            </div>
            
            ${emailPersonalMessage ? `
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; font-weight: bold; color: #78350f;">
                📝 Message from sender: "${emailPersonalMessage}"
              </div>
            ` : ''}
            
            <div style="border-top: 2px dashed #fed7aa; padding-top: 15px; margin-top: 15px;">
              <h3 style="color: #ea580c; font-size: 16px; font-weight: 800; margin-top: 0;">📖 Story Text:</h3>
              ${story.pages.map((page, idx) => `
                <div style="margin-bottom: 15px; padding: 12px; background-color: #fcf8f2; border: 1px solid #ffedd5; border-radius: 12px; font-size: 15px; line-height: 1.6; color: #334155;">
                  <strong style="color: #c2410c;">Page ${idx + 1}:</strong> ${page}
                </div>
              `).join('')}
            </div>
          </div>
          
          <div style="background-color: #fef3c7; border: 2px solid #fde68a; border-radius: 20px; padding: 15px; text-align: center; font-size: 13px; color: #78350f; font-weight: bold; margin-bottom: 20px;">
            💡 <strong>Cozy Storytelling Tip:</strong> 
            Try turning reading into an interactive game! Build phonetics by imitating character voices like ${story.character}, or point at stars and bunnies.
          </div>
          
          <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #94a3b8; font-weight: bold;">
            Sent automatically on behalf of ${gmailUser?.displayName || 'a lovely parent'} with Safe Kids Path • No App Ads • Dev Approved
          </div>
        </div>
      `;

      await sendGmailEmail(gmailToken, emailTo, subject, bodyHtml);
      setEmailSentSuccess(true);
      audio.playMagicSparkle();
      loadRecentEmails(gmailToken);
    } catch (err: any) {
      console.error('Failed to send mail:', err);
      alert(`Could not send email: ${err.message || err}`);
    } finally {
      setEmailSending(false);
    }
  };

  // Function to unlock developer gates with a password
  const initiateParentGate = () => {
    setParentGateAnswer('');
    setParentGateError(false);
    setIsParentModalOpen(true);
  };

  const handleVerifyParentGate = () => {
    if (parentGateAnswer === 'ramazan123') {
      setIsParentUnlocked(true);
      setParentGateError(false);
      // Auto populate first story modifications
      const current = storiesList.find(s => s.id === editingStoryId) || storiesList[0];
      if (current) {
        setEditingStoryId(current.id);
        setEditingImageUrl(current.cover);
        setEditingTitle(current.title);
        setEditingSub(current.sub);
        setEditingCharacter(current.character);
        setEditingAuthor(current.author);
        setEditingMusicUrl(current.customMusicUrl || '');
        setEditingVoiceUrl(current.customVoiceUrl || '');
        setEditingPagesText(current.pages.join('\n'));
      }
    } else {
      setParentGateError(true);
      audio.playBoing(); // playful buzzer sound
    }
  };

  const handleSelectEditingStory = (storyId: string, currentList: Story[] = storiesList) => {
    const target = currentList.find(s => s.id === storyId);
    if (target) {
      setEditingStoryId(storyId);
      setEditingImageUrl(target.cover);
      setEditingTitle(target.title);
      setEditingSub(target.sub);
      setEditingCharacter(target.character);
      setEditingAuthor(target.author);
      setEditingMusicUrl(target.customMusicUrl || '');
      setEditingVoiceUrl(target.customVoiceUrl || '');
      setEditingPagesText(target.pages.join('\n'));
    }
  };

  const handleOpenEditor = () => {
    setActiveTab('editor');
    handleSelectEditingStory(editingStoryId, storiesList);
  };

  const handleSaveStoryChanges = () => {
    const updated = storiesList.map(s => {
      if (s.id === editingStoryId) {
        const nextStory = {
          ...s,
          cover: editingImageUrl || s.cover,
          title: editingTitle || s.title,
          sub: editingSub || s.sub,
          character: editingCharacter || s.character,
          author: editingAuthor || s.author,
          customMusicUrl: editingMusicUrl || undefined,
          customVoiceUrl: editingVoiceUrl || undefined,
          pages: editingPagesText.split('\n').map(p => p.trim()).filter(p => p.length > 0)
        };
        // Update active instance immediately so storyplayer doesn't lag if they edit the playing story
        if (activeStory && activeStory.id === s.id) {
          setActiveStory(nextStory);
        }
        return nextStory;
      }
      return s;
    });

    setStoriesList(updated);
    localStorage.setItem('story_kids_custom_stories', JSON.stringify(updated));
    audio.playMagicSparkle();
  };

  const handleResetToDefaults = () => {
    if (confirm("Reset current audiobook library back to cozy defaults? This will restore original cover images and remove edits.")) {
      setStoriesList(stories);
      localStorage.removeItem('story_kids_custom_stories');
      
      const first = stories[0];
      setEditingStoryId(first.id);
      setEditingImageUrl(first.cover);
      setEditingTitle(first.title);
      setEditingSub(first.sub);
      setEditingCharacter(first.character);
      setEditingAuthor(first.author);
      setEditingMusicUrl(first.customMusicUrl || '');
      setEditingVoiceUrl(first.customVoiceUrl || '');
      setEditingPagesText(first.pages.join('\n'));

      if (activeStory) {
        const defaultVer = stories.find(s => s.id === activeStory.id);
        if (defaultVer) {
          setActiveStory(defaultVer);
        }
      }
      audio.playChime();
    }
  };

  // Sound triggers
  const triggerBubblePop = (bubbleId: number) => {
    audio.playBubble();
    setBubblePopScore(prev => {
      const news = prev + 1;
      localStorage.setItem('story_kids_bubble_score', String(news));
      return news;
    });
    // Relocate popped bubble
    setBgBubbles(prev => prev.map(b => b.id === bubbleId ? {
      ...b,
      left: Math.random() * 90 + 5,
      delay: 0,
      speed: Math.random() * 12 + 10,
    } : b));
  };

  // Audiobook narration core trigger
  const playCurrentPageText = (story: Story, pageIndex: number) => {
    if (!story) return;
    const textToSpeak = story.pages[pageIndex];
    setSpokenText(textToSpeak);
    setHighlitWordIdx(-1);
    setHighlitWordLen(0);
    setIsPlaying(true);
    setIsPaused(false);

    // Trigger text to speech
    audio.speak(
      textToSpeak,
      { 
        pitch: voicePitch, 
        rate: voiceRate, 
        volume: voiceVolume,
        customVoiceUrl: story.customVoiceUrl 
      },
      (charIndex, charLength) => {
        setHighlitWordIdx(charIndex);
        setHighlitWordLen(charLength);
      },
      () => {
        // Callback on narration completion
        setHighlitWordIdx(-1);
        setHighlitWordLen(0);

        // If it's a custom voice track (e.g. MP3), the complete single audio file has finished
        if (story.customVoiceUrl) {
          setIsPlaying(false);
          setStoriesListenedCount(prev => {
            const news = prev + 1;
            localStorage.setItem('story_kids_listened_count', String(news));
            return news;
          });
          audio.playMagicSparkle();
          setCurrentPageIndex(story.pages.length - 1);
          return;
        }

        // Standard Text-To-Speech (TTS) sequential page auto advance
        if (pageIndex === story.pages.length - 1) {
          setIsPlaying(false);
          setStoriesListenedCount(prev => {
            const news = prev + 1;
            localStorage.setItem('story_kids_listened_count', String(news));
            return news;
          });
          audio.playMagicSparkle();
        } else {
          const nextIdx = pageIndex + 1;
          setCurrentPageIndex(nextIdx);
          // Wait 800ms before starting the next page automatically so it feels natural
          setTimeout(() => {
            setActiveStory(prev => {
              if (prev && prev.id === story.id) {
                playCurrentPageText(prev, nextIdx);
              }
              return prev;
            });
          }, 800);
        }
      }
    );
  };

  // Launch a story
  const handleSelectStory = (story: Story) => {
    audio.playChime();
    setActiveStory(story);
    setCurrentPageIndex(0);
    setHighlitWordIdx(-1);
    setHighlitWordLen(0);
    
    // Start ambient sound layer
    if (bgMusicOn) {
      audio.startBackgroundMusic(story.soundPreset, story.customMusicUrl);
    }

    // Play page text (requires tiny delay so SpeechSynthesis can load)
    setTimeout(() => {
      playCurrentPageText(story, 0);
    }, 150);
  };

  // Stop/Pause story and exit
  const handleExitStory = () => {
    audio.playBoing();
    audio.stopSpeaking();
    audio.stopBackgroundMusic();
    setActiveStory(null);
    setIsPlaying(false);
    setIsPaused(false);
    setHighlitWordIdx(-1);
    setHighlitWordLen(0);
  };

  const handlePauseToggle = () => {
    audio.playChime();
    if (isPaused) {
      setIsPaused(false);
      audio.resumeSpeaking();
    } else {
      setIsPaused(true);
      audio.pauseSpeaking();
    }
  };

  const handleNextPage = () => {
    if (!activeStory) return;
    if (currentPageIndex < activeStory.pages.length - 1) {
      audio.playChime();
      const nextIdx = currentPageIndex + 1;
      setCurrentPageIndex(nextIdx);
      playCurrentPageText(activeStory, nextIdx);
    } else {
      audio.playMagicSparkle(); // Finished celebration!
    }
  };

  const handlePrevPage = () => {
    if (!activeStory) return;
    if (currentPageIndex > 0) {
      audio.playBubble();
      const prevIdx = currentPageIndex - 1;
      setCurrentPageIndex(prevIdx);
      playCurrentPageText(activeStory, prevIdx);
    }
  };

  const handlePageClick = (pageIdx: number) => {
    if (!activeStory) return;
    audio.playChime();
    setCurrentPageIndex(pageIdx);
    
    if (activeStory.customVoiceUrl) {
      const audioEl = audio.getCustomVoiceAudio();
      if (audioEl && customAudioDuration > 0) {
        const timestamps = getPageTimestamps();
        if (timestamps[pageIdx]) {
          audioEl.currentTime = timestamps[pageIdx].start;
          setCustomAudioTime(timestamps[pageIdx].start);
        }
      }
    } else {
      playCurrentPageText(activeStory, pageIdx);
    }
  };

  // Toggle Background Music selection
  const handleBgMusicToggle = () => {
    audio.playBubble();
    const nextVal = !bgMusicOn;
    setBgMusicOn(nextVal);
    if (nextVal && activeStory) {
      audio.startBackgroundMusic(activeStory.soundPreset, activeStory.customMusicUrl);
    } else {
      audio.stopBackgroundMusic();
    }
  };

  // Helper to render the entire transcript with the active paragraph highlighted
  const renderHighlightedNews = () => {
    if (!activeStory) return null;

    return (
      <div className="space-y-6">
        {activeStory.pages.map((pageText, idx) => {
          const isActive = idx === currentPageIndex;
          
          if (isActive) {
            // If it's active and we have word-specific highlights
            if (highlitWordIdx !== -1 && spokenText === pageText) {
              const before = spokenText.substring(0, highlitWordIdx);
              const highlighted = spokenText.substring(highlitWordIdx, highlitWordIdx + highlitWordLen);
              const after = spokenText.substring(highlitWordIdx + highlitWordLen);
              
              return (
                <div 
                  key={idx}
                  data-page-index={idx}
                  onClick={() => handlePageClick(idx)}
                  className="bg-yellow-50 border-2 border-dashed border-yellow-400 rounded-3xl p-5 shadow-sm transition-all duration-300 transform scale-[1.01] cursor-pointer hover:bg-yellow-100/40"
                >
                  <p className="leading-relaxed text-slate-800 text-xl md:text-2xl font-black font-sans break-words">
                    <span>{before}</span>
                    <span className="bg-yellow-300 border-2 border-dashed border-sky-600 px-1 rounded-md text-amber-950 font-black transition-all animate-pulse shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {highlighted}
                    </span>
                    <span>{after}</span>
                  </p>
                </div>
              );
            }

            // Active page/paragraph but without word highlights yet (or custom audio)
            return (
              <div 
                key={idx}
                data-page-index={idx}
                onClick={() => handlePageClick(idx)}
                className="bg-yellow-50 border-2 border-dashed border-yellow-400 rounded-3xl p-5 shadow-sm transition-all duration-300 transform scale-[1.01] cursor-pointer hover:bg-yellow-105/40"
              >
                <p className="leading-relaxed text-slate-800 text-xl md:text-2xl font-black font-sans break-words">
                  {pageText}
                </p>
              </div>
            );
          }

          // Inactive pages (past/future)
          const isPast = idx < currentPageIndex;
          return (
            <div 
              key={idx}
              data-page-index={idx}
              onClick={() => handlePageClick(idx)}
              className={`p-4 transition-all duration-300 rounded-3xl border border-transparent hover:border-slate-200 cursor-pointer hover:bg-slate-100 ${isPast ? 'opacity-40 filter grayscale-[20%]' : 'opacity-25 hover:opacity-50'}`}
            >
              <p className="leading-relaxed text-slate-705 text-lg md:text-xl font-medium font-sans break-words">
                {pageText}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div id="app-root" className="min-h-screen bg-playful text-sky-950 font-sans relative overflow-x-hidden flex flex-col select-none">
      
      {/* Background Interactive Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {bgBubbles.map((bubble) => (
          <div
            key={bubble.id}
            onClick={(e) => {
              // Make interactive inside coordinate clicks
              e.stopPropagation();
              triggerBubblePop(bubble.id);
            }}
            className="ambient-bubble flex justify-center items-center pointer-events-auto cursor-pointer hover:scale-130 active:scale-90 select-none"
            style={{
              left: `${bubble.left}%`,
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              animationDelay: `${bubble.delay}s`,
              animationDuration: `${bubble.speed}s`,
            }}
          >
            <div className="w-full h-full rounded-full bg-white/20 border-2 border-white/50 backdrop-blur-[1px] shadow-[inset_0px_4px_8px_rgba(255,255,255,0.4)] flex items-center justify-center text-xl md:text-2xl hover:bg-white/40 transition-all">
              {bubble.char}
            </div>
          </div>
        ))}
      </div>

      {/* Main App Bar Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b-4 border-orange-100 px-3 sm:px-6 py-2.5 sm:py-4 flex justify-between items-center shadow-md gap-3">
        <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 sm:w-14 sm:h-14 bg-yellow-400 rounded-full border-2 sm:border-4 border-white flex flex-none items-center justify-center text-xl sm:text-2xl shadow-md animate-wiggle">
            🧸
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-3xl md:text-5xl font-black text-orange-600 tracking-tight flex items-center gap-1 leading-tight sm:leading-none truncate mix-blend-multiply">
              <span className="truncate">Safe Kids Path Audio Book</span> <span className="text-yellow-400 font-extrabold text-base sm:text-xl flex-none hidden sm:inline">✨</span>
            </h1>
            <p className="text-[10px] sm:text-xs md:text-sm font-bold text-orange-850/80 hidden sm:block mt-0.5 sm:mt-1 truncate">A cozy story and audiobook castle for kids & developers</p>
          </div>
        </div>

        {/* Action Widgets */}
        <div className="flex items-center gap-2 sm:gap-3 flex-none">
          {/* Audio Complete Badge Counter */}
          <div className="hidden sm:flex bg-amber-100 border-3 border-white rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-extrabold text-orange-800 items-center gap-1 sm:gap-1.5 shadow-sm">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 fill-amber-200" />
            <span>{storiesListenedCount} Read</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-10 z-20 flex flex-col justify-center items-center">
        
        {/* VIEW 1: SELECT STORY (HOME SCREEN) */}
        {!activeStory && (
          <div className="w-full flex flex-col items-center">
            
            {/* Banner info */}
            <div className="bg-white/80 backdrop-blur-sm border-4 border-white rounded-[40px] p-6 max-w-2xl w-full text-center relative mb-12 shadow-xl animate-bounce-slow">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-yellow-400 text-white border-2 border-white rounded-full px-5 py-1 font-black text-xs uppercase tracking-wider shadow-sm">
                Welcome Storytellers! 🌟
              </div>
              <p className="text-slate-700 text-lg md:text-xl font-bold leading-relaxed pt-2">
                Click any beautiful cover below to read and listen to magical audiobooks together. Developers, check settings to configure read speed or set sleep timers!
              </p>
              
              {/* Toddler Bubbles Interaction Meter */}
              <div className="mt-4 pt-4 border-t-2 border-dashed border-orange-100 flex justify-center items-center gap-5 flex-wrap">
                <span className="text-sm font-extrabold text-orange-900/80 flex items-center gap-1">
                  🫧 Bubbles popped: <strong className="text-orange-950 font-black text-base">{bubblePopScore}</strong>
                </span>
                <button 
                  onClick={() => {
                    audio.playMagicSparkle();
                    setBubblePopScore(0);
                    localStorage.setItem('story_kids_bubble_score', '0');
                  }}
                  title="Reset pops scale"
                  className="bg-orange-50 hover:bg-orange-100 text-xs px-2 py-1 border border-orange-200 rounded-md font-bold text-orange-850"
                >
                  Reset Play Score
                </button>
              </div>
            </div>

            {/* Giant Grid of 6 StoryButtons */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 md:gap-10 w-full">
              {storiesList.map((story) => {
                const cardPopClass = story.id.includes('star') || story.id.includes('dragon') || story.id.includes('turtle') 
                  ? 'pop-blue' 
                  : 'pop-yellow';
                return (
                  <div 
                    key={story.id}
                    id={`story-card-${story.id}`}
                    className={`story-card ${cardPopClass} bg-white rounded-3xl sm:rounded-[40px] overflow-hidden flex flex-col`}
                  >
                    {/* Aspect Ratio 1:1 Album Cover Header */}
                    <div className="relative group overflow-hidden border-b-4 border-slate-100 flex-1">
                      <img 
                        src={story.cover} 
                        alt={story.title} 
                        referrerPolicy="no-referrer"
                        className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                      />
                      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-white/90 backdrop-blur-sm border-2 border-slate-100 rounded-xl sm:rounded-2xl px-2 sm:px-3 py-0.5 sm:py-1 flex items-center gap-1 sm:gap-1.5 shadow-sm">
                        <span className="text-xl sm:text-2xl">{story.emoji}</span>
                        <span className="text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-widest leading-none">{story.character}</span>
                      </div>
                      <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-slate-800/90 backdrop-blur-sm text-white font-bold text-[10px] sm:text-xs uppercase px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl shadow-sm">
                        By {story.author}
                      </div>
                    </div>

                    {/* Body Info */}
                    <div className="p-3 sm:p-6 flex flex-col justify-between bg-white flex-none min-h-[140px] sm:min-h-[160px]">
                      <div>
                        <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-800 leading-snug mb-1 sm:mb-1.5 tracking-tight">
                          {story.title}
                        </h2>
                        <p className="text-slate-500 text-[11px] sm:text-sm font-bold leading-relaxed mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-none">
                          {story.sub}
                        </p>
                      </div>

                      {/* Popping Yellow / Light Blue listen button */}
                      <button
                        id={`play-btn-${story.id}`}
                        onClick={() => handleSelectStory(story)}
                        className={`w-full py-2.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-lg font-black transition-all flex items-center justify-center gap-1.5 sm:gap-2 border-2 border-white cursor-pointer ${
                          cardPopClass === 'pop-blue'
                            ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-md' 
                            : 'bg-yellow-400 hover:bg-yellow-500 text-slate-900 shadow-md'
                        }`}
                      >
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                        <span className="hidden sm:inline">Listen Now! 🎧</span>
                        <span className="sm:hidden">Play 🎧</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Informational Bottom Disclaimer */}
            <div className="mt-16 text-center max-w-sm">
              <p className="text-xs font-bold text-orange-900/60 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Info className="w-4.5 h-4.5 text-orange-700" />
                No App Ads • Developer Approved • Native Voice
              </p>
            </div>

          </div>
        )}

        {/* VIEW 2: INTERACTIVE AUDIOBOOK STORYPLAYER */}
        {activeStory && (() => {
          const cardPopClass = activeStory.id.includes('star') || activeStory.id.includes('dragon') || activeStory.id.includes('turtle') 
            ? 'pop-blue' 
            : 'pop-yellow';

          return (
            <div className={`w-full max-w-4xl rounded-[40px] p-6 md:p-10 bg-white ${cardPopClass} relative flex flex-col gap-6 md:gap-8`}>
              
              {/* Thin, Colorful Page Progress Bar */}
              <div className="w-full flex flex-col gap-2">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border-2 border-white shadow-inner flex relative">
                  {activeStory.pages.map((_, idx) => {
                    const isActive = idx === currentPageIndex;
                    const isPast = idx < currentPageIndex;
                    // spectrum of cozy child-friendly colors
                    const colors = [
                      'from-pink-400 to-pink-500',   // Page 1...
                      'from-orange-400 to-orange-500',   
                      'from-amber-400 to-amber-500',
                      'from-emerald-400 to-emerald-500',
                      'from-cyan-400 to-cyan-500',
                      'from-violet-400 to-violet-500'
                    ];
                    const gradientClass = colors[idx % colors.length];

                    return (
                      <button
                        key={idx}
                        id={`progress-bar-page-${idx}`}
                        onClick={() => handlePageClick(idx)}
                        className={`flex-1 h-full cursor-pointer border-r last:border-r-0 border-white/40 transition-all duration-300 relative ${
                          isPast || isActive 
                            ? `bg-gradient-to-r ${gradientClass} opacity-100` 
                            : 'bg-slate-200/80 opacity-40 hover:opacity-70'
                        } ${isActive ? 'scale-y-125 shadow-md z-10' : ''}`}
                        title={`Go to Page ${idx + 1}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider px-1">
                  <span>Start 🚀</span>
                  <span className="text-orange-600/80 font-extrabold bg-orange-100/60 border border-orange-200/50 px-2 py-0.5 rounded-full">
                    Page {currentPageIndex + 1} of {activeStory.pages.length}
                  </span>
                  <span>Goal 🏆</span>
                </div>
              </div>
              
              {/* Top Navigation Row */}
              <div className="flex justify-between items-center bg-slate-50/80 backdrop-blur-md rounded-2xl px-4 py-3 border-2 border-slate-100 shadow-sm">
                
                {/* Exit Button */}
                <button
                  id="exit-story-btn"
                  onClick={handleExitStory}
                  className="bg-rose-400 hover:bg-rose-500 text-white font-extrabold text-sm md:text-base px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer border-2 border-white active:translate-y-0.5"
                >
                  <X className="w-5 h-5 stroke-[3px]" />
                  Exit Story 🚪
                </button>

                {/* Story Title Header */}
                <div className="text-center hidden sm:block">
                  <p className="text-xs font-black text-orange-600 uppercase tracking-widest bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
                    {currentPageIndex + 1} of {activeStory.pages.length} Pages
                  </p>
                  <h3 className="text-sm md:text-lg font-black text-slate-800 mt-0.5">
                    {activeStory.title}
                  </h3>
                </div>

                {/* Email via Gmail Button */}
                <button
                  onClick={() => {
                    audio.playChime();
                    setGmailStoryToEmail(activeStory);
                    setIsGmailModalOpen(true);
                    setEmailSentSuccess(false);
                    setEmailPersonalMessage('');
                  }}
                  className="bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs md:text-sm px-3.5 py-2.5 rounded-xl border-2 border-white shadow-sm flex items-center gap-1.5 cursor-pointer active:translate-y-0.5"
                  title="Email this full story & tips to yourself or a friend via Gmail"
                >
                  <Mail className="w-4.5 h-4.5 animate-pulse" />
                  <span className="hidden md:inline">Email Story 📧</span>
                  <span className="md:hidden">Email 📧</span>
                </button>

                {/* Background Music Toggle */}
                <button
                  onClick={handleBgMusicToggle}
                  className={`text-xs md:text-sm font-extrabold px-3.5 py-2.5 rounded-xl border-2 border-white shadow-sm flex items-center gap-1.5 cursor-pointer active:translate-y-0.5 ${
                    bgMusicOn ? 'bg-emerald-400 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <Music className={`w-4.5 h-4.5 ${bgMusicOn ? 'animate-bounce' : ''}`} />
                  <span>Music: {bgMusicOn ? 'ON 🎵' : 'OFF 🔇'}</span>
                </button>
              </div>

              {/* Middle Section: Big Cover + Interactive Narrator Highlighter */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center justify-center">
                
                {/* Left Column: Big Album Cover (40% width or 100% and centered when playing) */}
                <div className={`flex flex-col items-center justify-center transition-all duration-500 ${
                  isPlaying 
                    ? 'md:col-span-12 lg:col-span-12 w-full' 
                    : 'md:col-span-12 lg:col-span-5'
                }`}>
                  <div className={`relative p-3 bg-slate-50 border-2 border-slate-100 rounded-[32px] shadow-md aspect-square overflow-hidden w-full animate-wiggle flex items-center justify-center transition-all duration-550 ${
                    isPlaying 
                      ? 'max-w-[340px] md:max-w-[440px]' 
                      : 'max-w-[280px] md:max-w-none'
                  }`}>
                    <img 
                      src={activeStory.cover} 
                      alt={activeStory.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-[24px]"
                    />
                    
                    {/* Overlay play state visualizer */}
                    {isPlaying && !isPaused && (
                      <div className="absolute inset-5 border-4 border-dashed border-orange-400 rounded-[24px] animate-spin-slow pointer-events-none mix-blend-difference" />
                    )}
                  </div>
                  
                  {/* Character mascot caption */}
                  <div className="mt-4 bg-orange-100 border border-orange-250 text-orange-900 font-extrabold text-sm px-4 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                    <span>{activeStory.emoji}</span>
                    <span>Say Hello to {activeStory.character}!</span>
                  </div>
                </div>

                {/* Right Column: Giant Text Bubble with Narration Highlights (Hidden while playing) */}
                {!isPlaying && (
                  <div className="md:col-span-12 lg:col-span-7 flex flex-col justify-between bg-slate-50 border-2 border-slate-100 rounded-[32px] p-6 md:p-8 relative shadow-sm min-h-[350px] lg:min-h-[440px]">
                    
                    {/* Speech bubbles arrow decoration (Left position) */}
                    <div className="hidden lg:block absolute -left-4 top-1/2 -translate-y-4 w-4 h-8 bg-slate-50 border-l-2 border-b-2 border-slate-100 rotate-45" />

                    <div className="flex-1 overflow-y-auto max-h-[280px] lg:max-h-[360px] pr-2 mb-6 custom-scrollbar scroll-smooth">
                      {/* Custom Narrated Text Element */}
                      {renderHighlightedNews()}
                    </div>

                    {/* Subtitle helper or instruction */}
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-dashed border-orange-150 flex-wrap gap-2 text-slate-500 font-bold text-xs">
                      <span>✨ Click yellow words to repeat / read along</span>
                      <span>Narrated by {activeStory.author}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-Interactive Sandbox / Toddler Soundboard Deck */}
              <div className="bg-orange-50/50 backdrop-blur-sm border-2 border-orange-100 rounded-[32px] p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-2 px-1 text-slate-700">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span className="text-sm font-extrabold">Toddler Interactive Sound Effects Board: (Tap to pop sounds!)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <button
                    onClick={() => audio.playMagicSparkle()}
                    className="bg-yellow-300 hover:bg-yellow-400 active:translate-y-0.5 border-2 border-white rounded-xl py-2 px-3 text-xs md:text-sm font-black text-slate-800 shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                  >
                    ✨ Sparkle
                  </button>
                  <button
                    onClick={() => audio.playBubble()}
                    className="bg-sky-300 hover:bg-sky-400 active:translate-y-0.5 border-2 border-white rounded-xl py-2 px-3 text-xs md:text-sm font-black text-slate-800 shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                  >
                    🫧 Bubble Pop
                  </button>
                  <button
                    onClick={() => audio.playBoing()}
                    className="bg-rose-300 hover:bg-rose-400 active:translate-y-0.5 border-2 border-white rounded-xl py-2 px-3 text-xs md:text-sm font-black text-slate-800 shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                  >
                    trampoline Boing
                  </button>
                  <button
                    onClick={() => audio.playChime()}
                    className="bg-emerald-300 hover:bg-emerald-400 active:translate-y-0.5 border-2 border-white rounded-xl py-2 px-3 text-xs md:text-sm font-black text-slate-800 shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                  >
                    🔔 Star Chime
                  </button>
                  <button
                    onClick={() => audio.playZing()}
                    className="bg-violet-300 hover:bg-violet-400 active:translate-y-0.5 border-2 border-white rounded-xl py-2 px-3 text-xs md:text-sm font-black text-slate-800 shadow-sm flex items-center justify-center gap-1 cursor-pointer col-span-2 sm:col-span-1"
                  >
                    🚀 Laser Zing
                  </button>
                </div>
              </div>

              {/* Bottom Playback Controls (Volume settings and pause/resume) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-slate-50 border-2 border-slate-100 rounded-[32px] p-5 shadow-sm md:sticky md:bottom-2">
                
                {/* Pause/Play Controls (Centered) */}
                <div className="md:col-span-12 flex justify-center gap-4 flex-wrap">
                  
                  {/* Pause/Resume audio toggle */}
                  <button
                    id="pause-playback-btn"
                    onClick={handlePauseToggle}
                    className="bg-yellow-400 hover:bg-yellow-500 font-black text-lg py-3.5 px-8 rounded-2xl flex items-center justify-center gap-2 text-slate-800 shadow-sm cursor-pointer border-2 border-white active:translate-y-0.5 min-w-[150px]"
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-5 h-5 fill-current text-slate-800" />
                        <span>Resume 🌟</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-5 h-5 fill-current text-slate-800" />
                        <span>Pause ⏸️</span>
                      </>
                    )}
                  </button>
 
                  {/* Repeat narration voice */}
                  <button
                    onClick={() => playCurrentPageText(activeStory, currentPageIndex)}
                    className="bg-sky-450 hover:bg-sky-500 font-black text-sm py-3.5 px-5 rounded-2xl flex items-center justify-center gap-1.5 text-white shadow-sm cursor-pointer border-2 border-white active:translate-y-0.5 min-w-[150px]"
                    title="Repeat narrator speech"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Read Page 📣</span>
                  </button>
                </div>

                {/* Voice Volume & Speed Slider settings */}
                <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-dashed border-slate-200 text-slate-850">
                  
                  {/* Narrator volume control */}
                  <div className="flex items-center gap-3.5 px-2 bg-white/70 backdrop-blur-sm p-2 rounded-2xl border border-slate-100">
                    <Volume2 className="w-5 h-5 text-slate-600 flex-none" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-black">
                        <span>Story Voice Volume</span>
                        <span>{Math.round(voiceVolume * 100)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="1.0"
                        step="0.05"
                        value={voiceVolume}
                        onChange={(e) => setVoiceVolume(Number(e.target.value))}
                        className="w-full accent-yellow-400 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-1"
                      />
                    </div>
                  </div>

                  {/* Background music volume control */}
                  <div className={`flex items-center gap-3.5 px-2 p-2 rounded-2xl border transition-all ${
                    bgMusicOn ? 'bg-white/70 border-slate-105' : 'bg-slate-100 border-slate-200 opacity-50'
                  }`}>
                    <Music className="w-5 h-5 text-slate-600 flex-none" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-black text-slate-700">
                        <span>Sleepy Music Volume</span>
                        <span>{Math.round(musicVolume * 100)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="1.0"
                        step="0.05"
                        value={musicVolume}
                        disabled={!bgMusicOn}
                        onChange={(e) => setMusicVolume(Number(e.target.value))}
                        className="w-full accent-emerald-400 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-1"
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* Quiet Sleep Mode Timer Progress Line */}
              {sleepSecondsRemaining !== null && (
                <div className="bg-slate-800 text-white rounded-2xl px-4 py-2.5 border-2 border-white flex items-center justify-between text-xs font-bold animate-pulse">
                  <span>🛌 Sleep timer active: closing in {Math.floor(sleepSecondsRemaining / 60)}m {sleepSecondsRemaining % 60}s</span>
                  <button 
                    onClick={() => {
                      setSleepTimerMinutes(null);
                      setSleepSecondsRemaining(null);
                    }}
                    className="text-orange-300 hover:text-orange-200 underline font-black"
                  >
                    Cancel
                  </button>
                </div>
              )}

            </div>
          );
        })()}

      </main>

      {/* Footer / Developer Mode anchor */}
      <footer className="w-full pb-8 pt-4 flex items-center justify-center relative z-20">
        <button
          id="parent-dash-btn"
          onClick={initiateParentGate}
          className="control-btn bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm group whitespace-nowrap transition-colors"
        >
          <Settings className="w-4 h-4 animate-spin-slow group-hover:rotate-180 transition-transform" />
          <span>Developer Mode</span>
        </button>
      </footer>

      {/* DEVELOPER DASHBOARD CONSOLE MODAL */}
      {isParentModalOpen && (
        <div id="parent-modal" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-orange-50 border-4 border-white rounded-[40px] max-w-2xl w-full overflow-hidden shadow-2xl animate-wiggle my-8">
            
            {/* Modal Header */}
            <div className="bg-orange-200 border-b-2 border-white px-6 py-4 flex justify-between items-center text-slate-800 text-lg md:text-xl font-black">
              <div className="flex items-center gap-2">
                <Settings className="w-5.5 h-5.5 animate-spin-slow text-orange-600" />
                <span>Developer Safety Corner 🔐</span>
              </div>
              <button 
                onClick={() => {
                  setIsParentModalOpen(false);
                  setIsParentUnlocked(false);
                }}
                className="bg-white hover:bg-slate-100 border-2 border-orange-100 rounded-full p-1.5 shadow-sm active:translate-y-0.5 cursor-pointer text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 md:p-8">
              
              {/* STATE A: COZY GATE IS SECURED */}
              {!isParentUnlocked ? (
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="bg-amber-100 border-2 border-white p-4 rounded-full shadow-md">
                      <Settings className="w-10 h-10 text-slate-700 animate-spin-slow" />
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Developer Access Only</h3>
                  <p className="text-slate-600 font-bold text-sm mb-6 max-w-sm mx-auto">
                    Please enter the developer password to access timers, narration settings, and sleep guides!
                  </p>

                  {/* Password gated block */}
                  <div className="bg-white border-2 border-orange-100 rounded-2xl p-4 mb-4 max-w-xs mx-auto shadow-sm">
                    <span className="text-2xl font-black text-slate-800 block mb-2">Developer Password:</span>
                    <input 
                      type="password"
                      placeholder="Your password"
                      value={parentGateAnswer}
                      onChange={(e) => setParentGateAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleVerifyParentGate();
                      }}
                      className="w-full text-center border-2 border-orange-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-4 focus:ring-yellow-350 font-black text-xl bg-orange-50 text-slate-905"
                    />
                  </div>

                  {parentGateError && (
                    <p className="text-rose-600 font-black text-xs uppercase mb-4 animate-bounce">
                      Incorrect! Try again, friend! 🐻
                    </p>
                  )}

                  <button
                    onClick={handleVerifyParentGate}
                    className="w-full py-3 px-8 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-900 border-2 border-white font-black text-base cursor-pointer shadow-sm active:translate-y-0.5"
                  >
                    Open Developer Portal 🔓
                  </button>
                </div>
              ) : (
                
                // STATE B: GATE PASSED - DEVELOPER SETTINGS ARE UNLOCKED
                <div className="flex flex-col gap-5 text-slate-800">
                  
                  {/* Selection Tabs */}
                  <div className="flex border-b-2 border-orange-100 bg-orange-100/40 p-1 rounded-2xl gap-1">
                    <button
                      onClick={() => setActiveTab('cozy')}
                      className={`flex-1 py-2.5 text-xs md:text-sm font-black rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        activeTab === 'cozy' 
                          ? 'bg-white text-orange-950 shadow-sm' 
                          : 'text-orange-900/60 hover:text-orange-950'
                      }`}
                    >
                      <Clock className="w-4 h-4 text-orange-500" />
                      Cozy Controls 🛌
                    </button>
                    <button
                      onClick={handleOpenEditor}
                      className={`flex-1 py-2.5 text-xs md:text-sm font-black rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        activeTab === 'editor' 
                          ? 'bg-white text-orange-950 shadow-sm' 
                          : 'text-orange-900/60 hover:text-orange-950'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
                      Image/Story Editor 🛠️
                    </button>
                    <button
                      onClick={() => setActiveTab('gmail')}
                      className={`flex-1 py-2.5 text-xs md:text-sm font-black rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        activeTab === 'gmail' 
                          ? 'bg-white text-orange-950 shadow-sm' 
                          : 'text-orange-900/60 hover:text-orange-950'
                      }`}
                    >
                      <Mail className="w-4 h-4 text-sky-500" />
                      Gmail Hub 📧
                    </button>
                  </div>

                  {activeTab === 'cozy' ? (
                    <div className="flex flex-col gap-5">
                      {/* Sleep Timer Preset Tools */}
                      <div className="bg-white border-2 border-white p-4 rounded-2xl shadow-sm">
                        <h4 className="text-md sm:text-lg font-black flex items-center gap-1.5 text-slate-850 mb-1">
                          <Clock className="w-5 h-5 text-orange-500" />
                          Set Audiobook Sleep Timer
                        </h4>
                        <p className="text-xs font-bold text-slate-500 mb-3">
                          Tell the story engine to fade out and stop automatically after time. Perfect for bedtimes!
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {[5, 10, 15, 30].map((mins) => (
                            <button
                              key={mins}
                              onClick={() => {
                                audio.playChime();
                                setSleepTimerMinutes(mins);
                              }}
                              className={`py-2 border-2 border-white rounded-xl font-extrabold text-xs shadow-sm cursor-pointer hover:bg-amber-100 transition-all ${
                                sleepTimerMinutes === mins ? 'bg-amber-300 text-slate-850' : 'bg-amber-50 text-slate-700'
                              }`}
                            >
                              {mins} Mins 🛌
                            </button>
                          ))}
                        </div>
                        {sleepTimerMinutes !== null && (
                          <div className="mt-3 flex justify-between items-center bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-850">
                            <span>Timer active: {sleepTimerMinutes} minutes set.</span>
                            <button 
                              onClick={() => {
                                setSleepTimerMinutes(null);
                                setSleepSecondsRemaining(null);
                              }} 
                              className="hover:underline font-black uppercase text-amber-900"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Speech Modulation Settings */}
                      <div className="bg-white border-2 border-white p-4 rounded-2xl shadow-sm">
                        <h4 className="text-md sm:text-lg font-black flex items-center gap-1.5 text-slate-850 mb-1">
                          <Settings className="w-5 h-5 text-sky-500" />
                          Voice Pitch & Speeds Controls
                        </h4>
                        <p className="text-xs font-bold text-slate-500 mb-4 animate-pulse">
                          Adjust parameters to make the storyteller voice speak slower or sound sillier!
                        </p>
                        
                        <div className="flex flex-col gap-4">
                          {/* Voice Speed rate select */}
                          <div>
                            <div className="flex justify-between text-xs font-extrabold text-slate-600 mb-0.5">
                              <span>Story Speeds Pacing:</span>
                              <span className="bg-sky-100 text-sky-850 px-2 py-0.5 rounded text-[11px] font-black">
                                {voiceRate < 0.8 ? 'Slow Turtle' : voiceRate > 1.1 ? 'Fast Squirrel' : 'Gentle / Cozy'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">Slow🐢</span>
                              <input 
                                type="range"
                                min="0.6"
                                max="1.4"
                                step="0.1"
                                value={voiceRate}
                                onChange={(e) => {
                                  setVoiceRate(Number(e.target.value));
                                  if (activeStory) playCurrentPageText(activeStory, currentPageIndex);
                                }}
                                className="flex-1 accent-sky-500 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-400">Fast🐿️</span>
                            </div>
                          </div>

                          {/* Voice Pitch select */}
                          <div>
                            <div className="flex justify-between text-xs font-extrabold text-slate-600 mb-0.5">
                              <span>Story Teller Voice Tone (Pitch):</span>
                              <span className="bg-amber-100 text-amber-850 px-2 py-0.5 rounded text-[11px] font-black">
                                {voicePitch < 0.9 ? 'Papa Bear 🐻' : voicePitch > 1.3 ? 'Cute Pixie 🧚' : 'Friendly Guide'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">Low🐻</span>
                              <input 
                                type="range"
                                min="0.7"
                                max="1.6"
                                step="0.1"
                                value={voicePitch}
                                onChange={(e) => {
                                  setVoicePitch(Number(e.target.value));
                                  if (activeStory) playCurrentPageText(activeStory, currentPageIndex);
                                }}
                                className="flex-1 accent-amber-400 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-400">High🧚</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Parenting Tips Segment */}
                      <div className="bg-amber-100 border-2 border-white rounded-2xl p-4 flex gap-3 text-amber-900 font-bold">
                        <Heart className="w-7 h-7 text-rose-500 fill-rose-300 flex-none" />
                        <div>
                          <h5 className="text-sm font-black text-amber-950 mb-0.5">Cozy Developer Storytelling Tip:</h5>
                          <p className="text-[12px] leading-relaxed">
                            Try turning the speed to "Slow" (Slow Turtle) and asking your little one to repeat Barnaby's rabbit hiccups or spot the stars! Interaction builds immense phonetic skills.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : activeTab === 'editor' ? (
                    /* DEVELOPER / IMAGE EDITING PANEL */
                    <div className="flex flex-col gap-5 bg-white border border-orange-100 p-5 rounded-3xl shadow-sm">
                      <div>
                        <h4 className="text-lg font-black text-orange-600 flex items-center gap-1.5 mb-1">
                          🛠️ Story & Cover Image Customizer
                        </h4>
                        <p className="text-xs font-bold text-slate-500">
                          As a developer, you can live-change every single card's cover image, titles, characters, and descriptions instantly!
                        </p>
                      </div>

                      {/* Selector */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                          Select Book Card to Edit:
                        </label>
                        <select
                          value={editingStoryId}
                          onChange={(e) => handleSelectEditingStory(e.target.value)}
                          className="w-full border-2 border-orange-100 rounded-xl py-2.5 px-3 font-bold bg-orange-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer"
                        >
                          {storiesList.map((story) => (
                            <option key={story.id} value={story.id}>
                              {story.emoji} {story.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Cover URL Input with Live Grid Aspect Preview */}
                      <div className="bg-orange-50/30 p-4 rounded-2xl border border-orange-100 space-y-3">
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                          Book Cover Image Source (URL):
                        </label>
                        <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                          {/* Real-time image component preview */}
                          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-orange-200 bg-white overflow-hidden flex-none flex flex-col items-center justify-center relative shadow-inner">
                            {editingImageUrl ? (
                              <img
                                src={editingImageUrl}
                                alt="Live cover preview"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100&q=80";
                                }}
                              />
                            ) : (
                              <span className="text-2xl">🖼️</span>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between">
                            <input
                              type="text"
                              placeholder="Paste any http/https image URL"
                              value={editingImageUrl}
                              onChange={(e) => setEditingImageUrl(e.target.value)}
                              className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                            <div className="flex items-center gap-1.5 flex-wrap mt-2">
                              <span className="text-[10px] text-slate-400 font-extrabold mr-1">Try Preset Seeding:</span>
                              {[
                                { name: "🌲 Wood", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80" },
                                { name: "✨ Cosmic", url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80" },
                                { name: "🦕 Dragon", url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80" },
                                { name: "🌊 Waves", url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&q=80" }
                              ].map((preset) => (
                                <button
                                  key={preset.name}
                                  type="button"
                                  onClick={() => {
                                    audio.playBubble();
                                    setEditingImageUrl(preset.url);
                                  }}
                                  className="bg-white hover:bg-orange-100 border border-orange-150 px-2.5 py-1 rounded-md text-[10px] font-black text-slate-650 cursor-pointer shadow-sm transition-all"
                                >
                                  {preset.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional Story descriptive attributes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider">
                            Book Title:
                          </label>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider">
                            Author/Narrator:
                          </label>
                          <input
                            type="text"
                            value={editingAuthor}
                            onChange={(e) => setEditingAuthor(e.target.value)}
                            className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider">
                            Character Hero:
                          </label>
                          <input
                            type="text"
                            value={editingCharacter}
                            onChange={(e) => setEditingCharacter(e.target.value)}
                            className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider">
                            Card Subtitle:
                          </label>
                          <input
                            type="text"
                            value={editingSub}
                            onChange={(e) => setEditingSub(e.target.value)}
                            className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                            🎵 Background Music MP3 URL / Path:
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. /src/assets/audio/bg.mp3 or web link"
                            value={editingMusicUrl}
                            onChange={(e) => setEditingMusicUrl(e.target.value)}
                            className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                            📢 Narration Voice MP3 URL / Path:
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. /src/assets/audio/voice.mp3 or web link"
                            value={editingVoiceUrl}
                            onChange={(e) => setEditingVoiceUrl(e.target.value)}
                            className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                          📖 Book Pages / Text Transcript (One page per line):
                        </label>
                        <textarea
                          rows={6}
                          placeholder="Type or paste the story transcript. Use one line per page."
                          value={editingPagesText}
                          onChange={(e) => setEditingPagesText(e.target.value)}
                          className="w-full border-2 border-orange-100 rounded-2xl py-2.5 px-3 bg-white text-slate-805 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                        <div className="text-[10px] text-slate-400 font-extrabold leading-normal">
                          💡 Each line typed above represents a single page displayed on-screen as the audio plays.
                        </div>
                      </div>

                      {/* Saving action buttons row */}
                      <div className="flex gap-2 pt-2 border-t border-dashed border-slate-150">
                        <button
                          onClick={handleSaveStoryChanges}
                          className="flex-1 py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white font-black text-xs rounded-xl cursor-pointer shadow-sm active:translate-y-0.5 border-2 border-white text-center uppercase tracking-wider transition-all"
                        >
                          Save Changes Live 💾
                        </button>
                        <button
                          onClick={handleResetToDefaults}
                          className="py-3 px-4 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 font-extrabold text-xs rounded-xl cursor-pointer active:translate-y-0.5 text-center transition-all"
                        >
                          Reset Defaults ♻️
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* GMAIL HUB DEVELOPER VIEW PORTAL */
                    <div className="flex flex-col gap-5 bg-white border border-sky-100 p-5 rounded-3xl shadow-sm text-slate-800">
                      <div>
                        <h4 className="text-lg font-black text-sky-600 flex items-center gap-1.5 mb-1 animate-pulse">
                          📧 Connected Gmail Hub Dashboard
                        </h4>
                        <p className="text-xs font-bold text-slate-500">
                          Securely configure Gmail and Google scopes, send test safety report formats, or view live audit history logs.
                        </p>
                      </div>

                      {!gmailToken ? (
                        <div className="text-center py-6 border-2 border-dashed border-sky-100 bg-sky-50/20 rounded-2xl space-y-4">
                          <span className="text-4xl block">🔑</span>
                          <h5 className="font-extrabold text-sm text-slate-700">Google OAuth Disconnected</h5>
                          <p className="text-xs text-slate-500 max-w-xs mx-auto font-bold leading-normal">
                            Sign in with your Google account to connect the secure Gmail REST API and unlock direct-email delivery.
                          </p>
                          <div className="flex justify-center">
                            <button
                              onClick={handleGmailSignIn}
                              className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 shadow-sm cursor-pointer font-extrabold text-slate-700 text-xs transition-all"
                            >
                              Sign in with Google 
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Connected User details */}
                          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex justify-between items-center gap-4">
                            <div>
                              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Authentication Status</p>
                              <p className="text-sm font-black text-emerald-950 flex items-center gap-1">🟢 Connected correctly</p>
                              <p className="text-xs text-slate-600 font-bold mt-1">Logged in as: <strong className="text-slate-800">{gmailUser?.email}</strong></p>
                            </div>
                            <button
                              onClick={handleGmailSignOut}
                              className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3 py-1.5 rounded-xl cursor-pointer font-bold active:translate-y-0.5"
                            >
                              Disconnect
                            </button>
                          </div>

                          {/* Send sandbox preview row */}
                          <div className="p-4 rounded-2xl space-y-3 bg-slate-50 border border-slate-200">
                            <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-2">
                              <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest font-mono">Test Sandboxing</h5>
                              <p className="text-[10px] text-sky-600 font-black">Authorized via Rest API</p>
                            </div>
                            <p className="text-xs text-slate-500 font-bold mb-2">Select any story below to dispatch a mock safety check email instantly to your inbox:</p>
                            <div className="flex gap-2 flex-wrap pb-1">
                              {storiesList.slice(0, 3).map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    audio.playChime();
                                    setGmailStoryToEmail(item);
                                    setIsGmailModalOpen(true);
                                    setEmailSentSuccess(false);
                                  }}
                                  className="bg-white hover:bg-sky-100 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-black text-slate-700 cursor-pointer shadow-sm"
                                >
                                  {item.emoji} {item.title}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Recent Logs list */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                              <h5 className="text-xs font-black text-slate-600 uppercase tracking-wider">Mailbox Transaction Logs</h5>
                              <button 
                                onClick={() => loadRecentEmails(gmailToken!)}
                                className="text-[10px] text-sky-500 tracking-wider hover:underline font-black"
                              >
                                Refresh Log History
                              </button>
                            </div>
                            {emailLogs.length === 0 ? (
                              <p className="text-[11px] text-slate-400 font-extrabold italic text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-150 animate-pulse">
                                No mailbox records with "Safe Kids Path" found yet.
                              </p>
                            ) : (
                              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                {emailLogs.map((log, i) => {
                                  const headers = log.payload?.headers || [];
                                  const toVal = headers.find((h: any) => h.name === 'To')?.value || 'me';
                                  const subVal = headers.find((h: any) => h.name === 'Subject')?.value || 'Sub';
                                  return (
                                    <div key={i} className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg flex justify-between gap-4 items-center text-xs">
                                      <div className="truncate">
                                        <p className="font-extrabold text-slate-700 truncate">{subVal}</p>
                                        <p className="text-[10px] text-slate-400 font-bold truncate">To: {toVal}</p>
                                      </div>
                                      <span className="bg-sky-55 text-[10px] text-sky-600 font-black px-1.5 py-0.5 rounded border border-sky-100">Sent</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lock Screen / Clear portal button */}
                  <button
                    onClick={() => {
                      setIsParentUnlocked(false);
                      setIsParentModalOpen(false);
                    }}
                    className="mt-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl cursor-pointer text-sm border-2 border-white shadow-sm"
                  >
                    Lock & Close Panel 🔒
                  </button>

                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: GMAIL EMAIL MODAL & CONNECTOR */}
      {isGmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] border-4 border-sky-100 max-w-xl w-full shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden animate-wiggle">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-400 to-sky-500 text-white px-6 py-5 rounded-t-[28px] flex justify-between items-center flex-none">
              <div className="flex items-center gap-2">
                <span className="text-2xl animate-bounce">📧</span>
                <div>
                  <h3 className="text-lg sm:text-xl font-black">Gmail Mailbox Corner</h3>
                  <p className="text-xs text-sky-100 font-extrabold">Send stories and read offline together!</p>
                </div>
              </div>
              <button
                onClick={() => setIsGmailModalOpen(false)}
                className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 cursor-pointer transition-all border border-transparent hover:border-white/40"
                title="Close Window"
              >
                <X className="w-5 h-5 stroke-[3px]" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-705">
              
              {/* STATE A: NOT SIGNED IN */}
              {!gmailToken ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-20 h-20 bg-sky-50 border-2 border-sky-100 rounded-full flex items-center justify-center mx-auto text-4xl shadow-md">
                    🧸
                  </div>
                  <h4 className="text-lg font-black text-slate-800 font-sans">Hello, Storyteller!</h4>
                  <p className="text-sm font-bold text-slate-500 max-w-sm mx-auto leading-relaxed">
                    To send this story directly to any email address as an interactive, safe reading guide, sign in securely with your Google account.
                  </p>
                  
                  {/* Google Sign-In Button (Official Spec) */}
                  <div className="flex justify-center pt-2">
                    <button 
                      onClick={handleGmailSignIn}
                      className="relative flex items-center justify-center gap-3 px-6 py-3 border-2 border-slate-200 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 shadow-sm cursor-pointer font-black text-slate-700 text-sm transition-all"
                    >
                      <div className="w-5 h-5 flex-none flex items-center justify-center">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span className="font-extrabold text-slate-800">Sign in with Google</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-extrabold pt-2">
                    🔒 Rest assured, your token is kept safely in temporary memory.
                  </p>
                </div>
              ) : (
                
                /* STATE B: SECURELY SIGNED IN WITH GOOGLE */
                <div className="space-y-5">
                  
                  {/* Account Metadata Row */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {gmailUser?.photoURL ? (
                        <img 
                          src={gmailUser.photoURL} 
                          alt="Avatar" 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-sky-200 text-sky-800 rounded-full flex items-center justify-center font-extrabold text-sm">
                          {gmailUser?.email?.[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Connected Account</p>
                        <p className="text-sm font-extrabold text-slate-800">{gmailUser?.displayName || 'Happy Parent'}</p>
                        <p className="text-xs text-slate-500 font-bold">{gmailUser?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGmailSignOut}
                      className="bg-slate-150 hover:bg-slate-200 text-slate-750 p-2 rounded-xl border border-slate-300 cursor-pointer active:translate-y-0.5 flex items-center gap-1 text-xs font-bold transition-all"
                      title="Disconnect Account"
                    >
                      <LogOut className="w-4 h-4 text-slate-500" />
                      Sign Out
                    </button>
                  </div>

                  {gmailStoryToEmail ? (
                    /* SEND FLOW: PREVIEW THE EMAIL TO SEND */
                    <div className="space-y-4">
                      <div className="bg-amber-50/50 border-2 border-amber-100/50 rounded-2xl p-4">
                        <h5 className="text-xs font-black text-amber-800 uppercase tracking-wider mb-2">📬 Send Animated Audiobook Package</h5>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">To Email Address (Recipient):</label>
                            <input
                              type="email"
                              value={emailTo}
                              onChange={(e) => setEmailTo(e.target.value)}
                              placeholder="Enter friend or relative email address"
                              className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-yellow-350"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">Personal Message (Optional):</label>
                            <textarea
                              rows={2}
                              value={emailPersonalMessage}
                              onChange={(e) => setEmailPersonalMessage(e.target.value)}
                              placeholder="e.g. Look at this beautiful body safety story we read tonight!"
                              className="w-full border-2 border-orange-100 rounded-xl py-2 px-3 font-bold bg-white text-slate-800 text-xs focus:outline-none focus:ring-4 focus:ring-yellow-350"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Live Email Content Mock Template */}
                      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3 max-h-[160px] overflow-hidden opacity-90">
                        <p className="text-[10px] font-black text-slate-400">EMAIL LIVE PREVIEW:</p>
                        <div className="space-y-2 border-t border-dashed border-slate-200 pt-2 text-xs text-slate-600">
                          <p><strong>Subject:</strong> Safe Kids Path: Read "{gmailStoryToEmail.title}" Together! ✨</p>
                          <p><strong>Cover Emoji:</strong> {gmailStoryToEmail.emoji}</p>
                          <p><strong>Intro:</strong> {gmailStoryToEmail.sub}</p>
                          <p className="text-[10px] font-extrabold italic text-slate-400">Total {gmailStoryToEmail.pages.length} fully structured safety narrative pages included.</p>
                        </div>
                      </div>

                      {/* Explicit parent actions */}
                      {emailSentSuccess ? (
                        <div className="bg-emerald-50 border-2 border-emerald-200 text-emerald-900 rounded-2xl p-5 text-center space-y-2 animate-wiggle">
                          <span className="text-3xl text-emerald-600 block">✨ 🚀 ✨</span>
                          <h4 className="font-black text-md">Email Successfully Sent!</h4>
                          <p className="text-xs font-bold text-emerald-800">
                            The safety audiobook package has been dispatched from your Gmail address securely.
                          </p>
                          <button
                            onClick={() => {
                              setEmailSentSuccess(false);
                              setGmailStoryToEmail(null);
                            }}
                            className="bg-white hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs px-4 py-1.5 rounded-lg border border-emerald-300 shadow-sm mt-1 transition-all"
                          >
                            Send Another or View Logs
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to send this email to ${emailTo} on behalf of your Google Account?`)) {
                                handleSendStoryEmail(gmailStoryToEmail);
                              }
                            }}
                            disabled={emailSending}
                            className={`flex-1 font-black text-sm text-white py-3.5 px-6 rounded-2xl border-2 border-white shadow-md active:translate-y-0.5 flex justify-center items-center gap-2 cursor-pointer transition-all ${
                              emailSending ? 'bg-sky-400 opacity-85 cursor-wait' : 'bg-sky-500 hover:bg-sky-600'
                            }`}
                          >
                            <Send className="w-5 h-5" />
                            {emailSending ? 'Sending Package...' : 'Send via Gmail API 🚀'}
                          </button>
                          
                          <button
                            onClick={() => setGmailStoryToEmail(null)}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-300 font-bold text-slate-700 text-xs px-4 rounded-2xl cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* DEFAULT: LOGS CHECKER */
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-sky-50/40 border border-sky-100 px-3 py-2 rounded-xl">
                        <h5 className="text-xs font-black text-slate-650 flex items-center gap-1.5 uppercase tracking-wide">
                          <Inbox className="w-4 h-4 text-sky-500 animate-pulse" />
                          Mailbox Sending History (Filtered Log)
                        </h5>
                        <button
                          onClick={() => loadRecentEmails(gmailToken!)}
                          className="text-[10px] text-slate-400 font-black hover:text-sky-500 flex items-center gap-1 transition-all"
                          title="Refresh mailbox log details"
                        >
                          <RefreshCw className="w-3 h-3 animate-spin-slow" />
                          Sync
                        </button>
                      </div>

                      {emailLogs.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                          <span className="text-3xl block filter grayscale mb-1">📬</span>
                          <span className="text-xs text-slate-400 font-extrabold uppercase">No sent audiobook logs found</span>
                          <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1 leading-normal">
                            Try sending an audiobook by viewing any story and clicking the "Email Story 📧" button!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                          {emailLogs.map((log: any, idx) => {
                            const headers = log.payload?.headers || [];
                            const to = headers.find((h: any) => h.name === 'To')?.value || 'Recipient';
                            const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
                            const date = headers.find((h: any) => h.name === 'Date')?.value || '';
                            const readableDate = date ? new Date(date).toLocaleDateString() : '';
                            
                            return (
                              <div key={log.id || idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-inner text-xs flex justify-between gap-3 items-center hover:bg-sky-50/20 transition-all">
                                <div className="space-y-0.5 truncate mr-3">
                                  <p className="font-extrabold text-slate-800 text-xs truncate">{subject}</p>
                                  <p className="text-[10px] text-slate-400 font-extrabold tracking-wider truncate">To: {to}</p>
                                </div>
                                <span className="text-[10px] text-slate-400 font-black flex-none">{readableDate || 'Sent'}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="bg-sky-50 border border-sky-100/40 rounded-2xl p-4 text-center">
                        <p className="text-xs text-sky-850 font-black font-sans">Want to email a storytelling preset?</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Click any story below to preview and dispatch instantly!</p>
                        <div className="flex gap-2 flex-wrap justify-center mt-3">
                          {storiesList.slice(0, 3).map((story) => (
                            <button
                              key={story.id}
                              onClick={() => {
                                setGmailStoryToEmail(story);
                                setEmailSentSuccess(false);
                              }}
                              className="bg-white hover:bg-sky-100 border border-sky-150 px-3 py-1.5 rounded-xl font-extrabold text-[11px] text-slate-750 cursor-pointer shadow-sm active:translate-y-0.5 transition-all text-left"
                            >
                              {story.emoji} {story.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Bottom Panel */}
            <div className="bg-slate-50 px-6 py-4 rounded-b-[28px] border-t border-slate-100 flex justify-end flex-none">
              <button
                onClick={() => setIsGmailModalOpen(false)}
                className="bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-sm active:translate-y-0.5"
              >
                Close Corner
              </button>
            </div>

          </div>
        </div>
      )}

      {/* App Bottom Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t-4 border-orange-100 py-6 px-4 text-center mt-auto shadow-md z-10 font-bold text-sm text-slate-700">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-4xl mx-auto">
          <p>© 2026 Kids Audiobook Player . Hand-crafted with cozy care for tiny ears 🌳✨</p>
          <div className="flex items-center gap-3">
            <span className="bg-yellow-50 border border-yellow-250 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 text-yellow-800">
              <Baby className="w-3.5 h-3.5" /> Simple Design
            </span>
            <span className="bg-sky-50 border border-sky-200 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 text-sky-850">
              <User className="w-3.5 h-3.5" /> Developer Mode
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
