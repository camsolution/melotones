// Descripteurs techniques par style — les modèles IA généralistes connaissent
// mal les genres très locaux (Coupé-Décalé, Cabo Love, Kompa, Zouglou...).
// Volontairement concis (BPM + éléments essentiels) : un descriptif trop long
// grignote la marge disponible pour le message libre de l'utilisateur avant la
// limite de 300 caractères de MusicGPT (voir lib/promptBudget.ts).
export const styleDescriptors: Record<string, string> = {
  afrobeat:
    'Afrobeat at 100-115 BPM: syncopated horns, funky basslines, layered Afro-percussion, call-and-response chants, warm groove in the tradition of Fela Kuti',
  coupedecale:
    'Coupé-Décalé at 130-140 BPM: upbeat Ivorian dance rhythm, punchy electronic percussion, chant-driven ad-libs, festive four-on-the-floor groove',
  amapiano:
    'Amapiano at 112-120 BPM: jazzy piano chords, log drum bass, airy percussion, laid-back South African house groove, smooth vocal chops',
  zouk:
    'Zouk at 120-130 BPM: warm synth pads, romantic mid-tempo Caribbean groove, smooth guitar melodies, soulful vocals, sensual slow-dance feel',
  rnb:
    'Contemporary R&B at 70-90 BPM: smooth soulful vocals, layered harmonies, warm electric piano and deep bass, romantic polished production',
  acoustic:
    'Acoustic ballad: intimate fingerpicked guitar, warm natural vocals, minimal percussion, heartfelt stripped-down arrangement',
  gospel:
    'Gospel: uplifting choir harmonies, soulful lead vocals, Hammond organ, clapping rhythm, joyful spiritual call-and-response feel',
  highlife:
    'Highlife style at 100-120 BPM: bright melodic electric guitar lines, horn section, swinging Ghanaian dance rhythm, warm percussion, celebratory upbeat groove',
  cabo:
    'Cabo Love (Cape Verdean romance) at 90-100 BPM: warm synth pads, mid-tempo zouk/kizomba groove, melodic guitar, soulful Creole vocal delivery',
  rap:
    'Rap / Hip-Hop style at 85-95 BPM: punchy trap-influenced drum pattern, deep 808 bass, sharp hi-hats, rhythmic confident vocal delivery, modern urban production',
  afro:
    'Afro-fusion at 100-112 BPM: African percussion with modern pop production, melodic kora-inspired guitar, soulful vocals, global crossover groove',
  reggae:
    'Reggae at 60-90 BPM: laid-back off-beat guitar skank, rolling basslines, one-drop drum pattern, organ bubble, conscious vocal delivery à la Bob Marley',
  kompa:
    'Haitian Kompa at 100-120 BPM: smooth Caribbean groove, interlocking guitar licks, warm synth pads, conga and cowbell rhythm, soulful Creole vocal phrasing',
  salsa:
    'Salsa at 170-200 BPM: energetic Latin percussion (congas, timbales, claves), horn section, syncopated piano montuno, passionate call-and-response vocals',
  zouglou:
    'Ivorian Zouglou at 110-125 BPM: percussion-driven groove, chant-like call-and-response vocals, handclaps, street-party energy, in the tradition of Magic System',
  nigerianmusic:
    'Contemporary Nigerian Afrobeats at 100-112 BPM: log drum bass, syncopated percussion, Pidgin-English vocal ad-libs, laid-back danceable Naija-pop groove',
  arabic:
    'Arabic pop at 80-100 BPM: string orchestration (strings, oud), quarter-tone maqam melodies, darbuka percussion, emotive melisma vocal ornamentation',
};
