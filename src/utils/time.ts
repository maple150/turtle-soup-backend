export function now() {
  return Date.now()
}

export function secondsFromNow(seconds: number) {
  return now() + seconds * 1000
}

export function toUnixSeconds(ms: number) {
  return Math.floor(ms / 1000)
}
