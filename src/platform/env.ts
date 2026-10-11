/**
 * True in the build published as a claude.ai Artifact (`npm run artifact`).
 * That page runs inside a locked-down frame: no camera, no location, no
 * printing, no service worker, no requests to other sites, and phone and
 * email links may not open. The app keeps every feature that still works there
 * and says plainly which ones are off.
 */
export const IN_ARTIFACT = import.meta.env.MODE === 'artifact';
