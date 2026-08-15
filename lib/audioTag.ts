import { ID3Writer } from 'browser-id3-writer';

// ImageType.CoverFront de browser-id3-writer — recopié en littéral car c'est
// un `const enum` : isolatedModules (transpilation Next.js/SWC fichier par
// fichier) ne peut pas les résoudre à l'import.
const IMAGE_TYPE_COVER_FRONT = 0x03;

// Intègre la cover comme pochette (tag ID3 APIC) directement dans le MP3 —
// remplace l'ancienne approche vidéo (ffmpeg.wasm, ~32 Mo, encodage lent) :
// ici c'est de la manipulation binaire pure, quasi instantanée, sans aucune
// dépendance lourde. Le fichier obtenu reste un simple .mp3, lisible partout,
// et affiche la cover comme pochette d'album dans la plupart des lecteurs
// (WhatsApp, Musique, lecteurs de fichiers) sans avoir besoin d'une vidéo.
export async function embedCoverArt(audioUrl: string, coverUrl: string, title: string): Promise<Blob> {
  const [audioBuf, coverBuf] = await Promise.all([
    fetch(audioUrl).then(r => r.arrayBuffer()),
    fetch(coverUrl).then(r => r.arrayBuffer()),
  ]);

  const writer = new ID3Writer(audioBuf);
  writer.setFrame('TIT2', title);
  writer.setFrame('TPE1', ['Melotones']);
  writer.setFrame('APIC', {
    type: IMAGE_TYPE_COVER_FRONT,
    data: coverBuf,
    description: 'Cover',
  });
  writer.addTag();
  return writer.getBlob();
}
