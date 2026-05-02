
export const playSfx = (file: 'ui click.mp3' | 'positive chime.mp3' | 'error buzz.mp3' | 'minimal alert.mp3') => {
  const volStr = localStorage.getItem('stb_sfx_vol');
  const volume = volStr !== null ? parseFloat(volStr) : 0.7;
  const audio = new Audio(`/audio/${file}`);
  audio.volume = volume;
  audio.play().catch(e => {
    // Silent fail if blocked by browser autoplay policy
    console.debug('SFX Autoplay blocked or failed:', e);
  });
};
