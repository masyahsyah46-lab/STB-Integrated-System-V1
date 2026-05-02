
/**
 * Global audio management for the system
 * Ensures compliance with modern browser autoplay policies
 */

class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private clickSound: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private currentTrackIndex: number = 0;
  private tracks: string[] = [
    "https://raw.githubusercontent.com/Masyahsyah46/system-stb-bersepadu/main/public/lagu1.mp3",
    "https://raw.githubusercontent.com/Masyahsyah46/system-stb-bersepadu/main/public/lagu2.mp3",
    "https://raw.githubusercontent.com/Masyahsyah46/system-stb-bersepadu/main/public/lagu3.mp3"
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      this.clickSound = new Audio("https://raw.githubusercontent.com/Masyahsyah46/system-stb-bersepadu/main/public/ui%20click.mp3");
      this.clickSound.volume = 0.5;
    }
  }

  /**
   * Initializes BGM with tracks
   */
  public initBGM() {
    if (this.bgm) return;

    this.bgm = new Audio(this.tracks[this.currentTrackIndex]);
    this.bgm.volume = 0.3;
    this.bgm.onended = () => this.nextTrack();
  }

  private nextTrack() {
    if (!this.bgm) return;
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.bgm.src = this.tracks[this.currentTrackIndex];
    if (!this.isMuted) {
      this.bgm.play().catch(e => console.warn("BGM Play Error:", e));
    }
  }

  public playBGM() {
    if (!this.bgm) this.initBGM();
    if (!this.bgm) return;
    
    this.bgm.play().catch(e => {
        console.warn("BGM blocked by browser policy. Interaction needed.");
    });
  }

  public pauseBGM() {
    if (this.bgm) this.bgm.pause();
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.bgm) {
      if (this.isMuted) this.bgm.pause();
      else this.bgm.play().catch(() => {});
    }
    return this.isMuted;
  }

  public playClick() {
    if (this.isMuted || !this.clickSound) return;
    
    try {
      this.clickSound.currentTime = 0;
      this.clickSound.play().catch(() => {});
    } catch (e) {}
  }

  /**
   * Sets up global click sounds for all buttons and interactive elements
   */
  public setupGlobalClicks() {
    if (typeof document === 'undefined') return;

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' || 
        target.closest('button') || 
        target.classList.contains('btn') || 
        target.classList.contains('tab-btn') ||
        target.tagName === 'A'
      ) {
        this.playClick();
      }
    }, true);
  }
}

export const audioManager = new AudioManager();
