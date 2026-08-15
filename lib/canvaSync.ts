import { supabaseAdmin } from '@/lib/admin';
import { getCanvaFolder, listCanvaFolderItems, type CanvaDesign, type CanvaFolder } from '@/lib/canva';

// Racine du studio créatif Canva ("MELOTONES — CREATIVE & MARKETING STUDIO"),
// construite via Canva MCP le 2026-08-13 — confirmée accessible via la même
// Connect API REST le 2026-08-14. Surchargeable si le studio est un jour
// recréé ailleurs.
const ROOT_FOLDER_ID = process.env.CANVA_ROOT_FOLDER_ID || 'FAHSMg_85oQ';

// Les designs du cycle marketing précédent ont été déplacés en tant que
// SOUS-dossiers des 24 dossiers du studio (ex: 13_CAROUSELS/03_CARROUSELS/...)
// plutôt que d'être directement dedans — confirmé le 2026-08-14 (une première
// version non récursive trouvait 24 dossiers mais 0 design). D'où la marche
// récursive avec limite de profondeur/nombre pour éviter tout emballement.
const MAX_DEPTH = 6;
const MAX_FOLDERS_VISITED = 300;

export type SyncAction = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'MANUAL_CHECK';

export type SyncItem = {
  action: SyncAction;
  canvaDesignId: string;
  title: string;
  folderId: string;
  folderName: string;
  topLevelFolder: string; // l'un des 24 dossiers du studio, même si le design est niché plus bas
  reason?: string;
};

export type SyncReport = {
  dryRun: boolean;
  rootFolder: string | null;
  foldersScanned: number;
  designsFound: number;
  toCreate: number;
  toUpdate: number;
  unchanged: number;
  manualCheck: number;
  writeErrors: number;
  items: SyncItem[];
  error?: string;
};

type ExistingAsset = { canva_design_id: string; canva_updated_at: string | null };
type FoundDesign = { design: CanvaDesign; folderId: string; folderName: string; topLevelFolder: string };

async function walkFolder(
  folderId: string,
  folderName: string,
  topLevelFolder: string,
  depth: number,
  state: { foldersVisited: number; designs: FoundDesign[] }
): Promise<void> {
  if (depth > MAX_DEPTH || state.foldersVisited >= MAX_FOLDERS_VISITED) return;
  state.foldersVisited += 1;

  const { folders, designs } = await listCanvaFolderItems(folderId, ['folder', 'design']);
  for (const design of designs) {
    state.designs.push({ design, folderId, folderName, topLevelFolder });
  }
  for (const sub of folders) {
    if (state.foldersVisited >= MAX_FOLDERS_VISITED) break;
    await walkFolder(sub.id, sub.name, topLevelFolder, depth + 1, state);
  }
}

const EMPTY_REPORT_BASE = { foldersScanned: 0, designsFound: 0, toCreate: 0, toUpdate: 0, unchanged: 0, manualCheck: 0, writeErrors: 0, items: [] as SyncItem[] };

export async function syncCanvaContentAssets({ dryRun }: { dryRun: boolean }): Promise<SyncReport> {
  const root = await getCanvaFolder(ROOT_FOLDER_ID);
  if (!root) {
    return {
      dryRun, rootFolder: null, ...EMPTY_REPORT_BASE,
      error: `Dossier racine Canva introuvable (${ROOT_FOLDER_ID}) — non connecté ou dossier supprimé/renommé.`,
    };
  }

  // Vérifié explicitement plutôt que traité en silence : si la table n'existe
  // pas encore (migration non exécutée), il ne faut jamais laisser le rapport
  // prétendre à un succès basé sur un calcul déconnecté de l'écriture réelle
  // (bug constaté le 2026-08-14 : "Synchronisation confirmée" affiché alors
  // qu'aucune ligne n'avait réellement été écrite).
  const { data: existingRows, error: readError } = await supabaseAdmin
    .from('content_assets')
    .select('canva_design_id, canva_updated_at');
  if (readError) {
    return {
      dryRun, rootFolder: root.name, ...EMPTY_REPORT_BASE,
      error: `Table content_assets inaccessible (${readError.message}) — la migration SQL a-t-elle bien été exécutée ?`,
    };
  }
  const existingById = new Map<string, ExistingAsset>((existingRows || []).map((r: ExistingAsset) => [r.canva_design_id, r]));

  const { folders: topLevelFolders } = await listCanvaFolderItems(ROOT_FOLDER_ID, ['folder']);

  const state = { foldersVisited: 0, designs: [] as FoundDesign[] };
  for (const folder of topLevelFolders as CanvaFolder[]) {
    await walkFolder(folder.id, folder.name, folder.name, 1, state);
  }

  const titleSeen = new Map<string, string>(); // titre normalisé -> premier folder_id où vu
  const items: SyncItem[] = [];
  let writeErrors = 0;
  let firstWriteError: string | null = null;

  for (const { design, folderId, folderName, topLevelFolder } of state.designs) {
    const normalizedTitle = design.title.trim().toLowerCase();
    const firstSeenFolder = titleSeen.get(normalizedTitle);

    if (firstSeenFolder && firstSeenFolder !== folderId) {
      items.push({
        action: 'MANUAL_CHECK', canvaDesignId: design.id, title: design.title,
        folderId, folderName, topLevelFolder,
        reason: 'Titre identique déjà vu dans un autre dossier — doublon potentiel, non fusionné automatiquement (section 34 : pas de résolution de conflit automatique).',
      });
      continue;
    }
    titleSeen.set(normalizedTitle, folderId);

    const existing = existingById.get(design.id);
    const designUpdatedIso = new Date(design.updated_at * 1000).toISOString();

    if (!existing) {
      items.push({ action: 'CREATE', canvaDesignId: design.id, title: design.title, folderId, folderName, topLevelFolder });
    } else if (existing.canva_updated_at !== designUpdatedIso) {
      items.push({ action: 'UPDATE', canvaDesignId: design.id, title: design.title, folderId, folderName, topLevelFolder });
    } else {
      items.push({ action: 'UNCHANGED', canvaDesignId: design.id, title: design.title, folderId, folderName, topLevelFolder });
    }

    if (!dryRun) {
      let writeError: string | null | undefined;
      if (!existing || existing.canva_updated_at !== designUpdatedIso) {
        const { error } = await supabaseAdmin.from('content_assets').upsert({
          canva_design_id: design.id,
          canva_folder_id: folderId,
          canva_folder_name: folderName,
          canva_edit_url: design.urls?.edit_url ?? null,
          canva_view_url: design.urls?.view_url ?? null,
          thumbnail_url: design.thumbnail?.url ?? null,
          title: design.title,
          page_count: design.page_count ?? null,
          platform: topLevelFolder,
          status: existing ? undefined : 'DISCOVERED',
          canva_created_at: new Date(design.created_at * 1000).toISOString(),
          canva_updated_at: designUpdatedIso,
          last_sync_at: new Date().toISOString(),
          sync_error: null,
        }, { onConflict: 'canva_design_id' });
        writeError = error?.message;
      } else {
        const { error } = await supabaseAdmin.from('content_assets').update({ last_sync_at: new Date().toISOString() }).eq('canva_design_id', design.id);
        writeError = error?.message;
      }
      if (writeError) {
        writeErrors += 1;
        firstWriteError = firstWriteError ?? writeError;
      }
    }
  }

  return {
    dryRun,
    rootFolder: root.name,
    foldersScanned: state.foldersVisited,
    designsFound: state.designs.length,
    toCreate: items.filter(i => i.action === 'CREATE').length,
    toUpdate: items.filter(i => i.action === 'UPDATE').length,
    unchanged: items.filter(i => i.action === 'UNCHANGED').length,
    manualCheck: items.filter(i => i.action === 'MANUAL_CHECK').length,
    writeErrors,
    items,
    error: writeErrors > 0 ? `${writeErrors} écriture(s) ont échoué — première erreur : ${firstWriteError}` : undefined,
  };
}
