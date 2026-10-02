// Original pentatonic reel, synthesized locally; no samples or network audio.
const REEL = [0, 7, 12, 7, 9, 7, 4, 2, 0, 4, 7, 12, 14, 12, 9, 7,
  9, 12, 16, 14, 12, 9, 7, 4, 7, 9, 7, 4, 2, 4, 2, 0];

export class HighlandAudio {
  constructor() {
    this.enabled = false;
    this.playing = false;
    this.timer = null;
    this.context = null;
  }
  async toggle() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("This browser doesn't support Web Audio.");
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
      this.drone = this.context.createOscillator();
      this.drone.type = "triangle";
      this.drone.frequency.value = 146.83;
      const gain = this.context.createGain();
      gain.gain.value = .055;
      this.drone.connect(gain).connect(this.master);
      this.drone.start();
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    this.sync();
    return this.enabled;
  }
  setPlaying(playing) { this.playing = playing; this.sync(); }
  sync() {
    if (!this.context) return;
    const audible = this.enabled && this.playing;
    this.master.gain.setTargetAtTime(audible ? .5 : 0, this.context.currentTime, .025);
    if (audible && !this.timer) {
      this.note = 0;
      this.nextTime = this.context.currentTime + .05;
      this.timer = window.setInterval(() => this.schedule(), 80);
      this.schedule();
    } else if (!audible && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  tone(frequency, start, duration, volume = .1, type = "triangle", endFrequency = frequency) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  schedule() {
    while (this.nextTime < this.context.currentTime + .22) {
      const frequency = 293.66 * 2 ** (REEL[this.note % REEL.length] / 12);
      this.tone(frequency, this.nextTime, .16, .07, "sawtooth");
      this.tone(frequency * 1.003, this.nextTime, .15, .04, "triangle");
      if (this.note % 4 === 0) this.tone(100, this.nextTime, .1, .2, "sine", 45);
      this.note++;
      this.nextTime += .1875;
    }
  }
  effect(type) {
    if (!this.enabled || !this.playing || !this.context) return;
    const now = this.context.currentTime;
    if (type === "bounce") this.tone(220, now, .09, .13, "sine", 480);
    if (type === "thistle" || type === "cameo") {
      [587.33, 739.99, 880].forEach((f, i) => this.tone(f, now + i * .065, .17, .12));
    }
    if (type === "pipes") [293.66, 440, 587.33, 880].forEach((f, i) => this.tone(f, now + i * .07, .22, .1, "sawtooth"));
    if (type === "over") this.tone(350, now, .4, .18, "triangle", 80);
    if (type === "crumble") this.tone(150, now, .14, .13, "sawtooth", 40);
  }
}
