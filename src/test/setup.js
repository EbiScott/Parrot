import '@testing-library/jest-dom/vitest'

// jsdom has no media stack and no object URL support. The components only need
// these to exist; the interesting behaviour is verified with spies.
if (typeof window !== 'undefined' && typeof HTMLMediaElement !== 'undefined') {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => `blob:mock-${Math.random().toString(36).slice(2)}`
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = () => {}
  }

  HTMLMediaElement.prototype.play = function play() {
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  }
  HTMLMediaElement.prototype.pause = function pause() {
    this.dispatchEvent(new Event('pause'))
  }
  HTMLMediaElement.prototype.load = function load() {}
}
