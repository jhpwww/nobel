/**
 * caught.ts — the one fact every room reports about its own opening piece.
 *
 * Each room opens with something at full size — the hall's six pieces, a
 * prize room's sculpture, the medal, the film reel, the learning area's
 * device, a laureate's name — and each has its own moment at which that
 * thing is caught into the mark beside the museum's name (the hall calls it
 * withdrawing). Four scripts decide those moments, each by its own
 * arithmetic, and until the floor plan nothing outside them needed to know.
 * The plan appears at exactly that moment on every page, so each of them
 * says it here, in one word on <html>, and the plan reads that word alone.
 *
 * A new room with a catch of its own must call this where it toggles its
 * own attribute, or the plan never appears there.
 */
export function setCaught(on: boolean): void {
  document.documentElement.toggleAttribute('data-caught', on);
}
