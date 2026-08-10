// Descripteurs COURTS (≤150 caractères) — MusicGPT limite music_style ET prompt
// à 300 caractères chacun, donc on garde ces essences concises plutôt que
// les longues descriptions techniques utilisées précédemment.
export const styleDescriptors: Record<string, string> = {
  mbalax: 'Senegalese Mbalax: sabar drums, tama talking drum, griot call-and-response vocals, festive groove',
  afrobeat: 'Afrobeat: horn section, funky basslines, layered percussion, call-and-response chants',
  coupedecale: 'Coupé-Décalé: upbeat Ivorian dance rhythm, electronic percussion, festive chants',
  amapiano: 'Amapiano: jazzy piano chords, log drum bass, laid-back South African house groove',
  zouk: 'Zouk: warm synth pads, romantic Caribbean groove, smooth guitar, soulful vocals',
  rnb: 'Contemporary R&B: smooth soulful vocals, laid-back groove, warm bass, romantic feel',
  acoustic: 'Acoustic ballad: fingerpicked guitar, warm natural vocals, intimate heartfelt tone',
  gospel: 'Gospel: uplifting choir harmonies, soulful lead vocals, Hammond organ, joyful spirit',
  highlife: 'Highlife: bright melodic guitar, horn section, swinging Ghanaian dance rhythm',
  cabo: 'Cabo Love: romantic synth pads, mid-tempo Creole groove, gentle melodic guitar',
  rap: 'Rap/Hip-Hop: trap-influenced beat, deep 808 bass, confident rhythmic vocal delivery',
};

// Construit un prompt qui respecte la limite de 300 caractères de MusicGPT,
// en priorisant toujours le message personnalisé de l'utilisateur.
export function buildSafePrompt(styleEssence: string, occasion: string, customMessage: string): string {
  const MAX = 300;
  const suffix = `. For ${occasion}: `;
  const budgetForMessage = MAX - styleEssence.length - suffix.length;

  if (budgetForMessage <= 0) {
    // Style essence déjà trop long à lui seul (garde-fou théorique)
    return `${styleEssence}`.slice(0, MAX);
  }

  const message = customMessage.length > budgetForMessage
    ? customMessage.slice(0, budgetForMessage - 1) + '…'
    : customMessage;

  return `${styleEssence}${suffix}${message}`.slice(0, MAX);
}
