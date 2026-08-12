import { supabaseAdmin, getEmailsByIds } from '@/lib/admin';

export type PartnerReportRow = {
  email: string;
  couponCode: string;
  packId: string;
  credits: number;
  priceFcfa: number;
  commissionFcfa: number;
  createdAt: string;
};

export type PartnerReport = {
  partnerName: string;
  commissionPercent: number;
  rows: PartnerReportRow[];
  totalSales: number;
  totalRevenueFcfa: number;
  totalCommissionFcfa: number;
};

// Commission dynamique : calculée vente par vente (prix réellement payé après
// remise coupon × taux du partenaire), pas un montant fixe — elle varie donc
// naturellement selon le nombre de ventes et le pack acheté par chacune.
export async function computePartnerReport(partnerId: string): Promise<PartnerReport | null> {
  const { data: partner } = await supabaseAdmin
    .from('partners')
    .select('name, commission_percent')
    .eq('id', partnerId)
    .single();
  if (!partner) return null;

  const { data: coupons } = await supabaseAdmin.from('coupons').select('id, code').eq('partner_id', partnerId);
  const couponIds = (coupons || []).map((c) => c.id);
  const couponByIdCode = new Map((coupons || []).map((c) => [c.id, c.code]));

  let purchases: any[] = [];
  if (couponIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('purchase_requests')
      .select('*')
      .in('coupon_id', couponIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    purchases = data || [];
  }

  const emailsById = await getEmailsByIds(purchases.map((p) => p.user_id));
  const commissionPercent = partner.commission_percent ?? 0;

  const rows: PartnerReportRow[] = purchases.map((p) => ({
    email: emailsById.get(p.user_id) || p.user_id,
    couponCode: couponByIdCode.get(p.coupon_id) || '',
    packId: p.pack_id,
    credits: p.credits,
    priceFcfa: p.price_fcfa,
    commissionFcfa: Math.round((p.price_fcfa * commissionPercent) / 100),
    createdAt: p.created_at,
  }));

  const totalSales = rows.length;
  const totalRevenueFcfa = rows.reduce((sum, r) => sum + r.priceFcfa, 0);
  const totalCommissionFcfa = rows.reduce((sum, r) => sum + r.commissionFcfa, 0);

  return { partnerName: partner.name, commissionPercent, rows, totalSales, totalRevenueFcfa, totalCommissionFcfa };
}
