import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { approvePurchaseRequest, rejectPurchaseRequest } from '@/lib/purchaseApproval';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { action } = await request.json(); // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const result = action === 'approve'
    ? await approvePurchaseRequest(params.id, user!.id)
    : await rejectPurchaseRequest(params.id, user!.id);

  if (!result.ok) return NextResponse.json({ error: (result as any).error || 'Erreur' }, { status: (result as any).status || 409 });
  return NextResponse.json({ ok: true });
}
