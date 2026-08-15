'use client';
import { useMemo, useState } from 'react';

export type AnalyticsSeriesPoint = { date: string; visitors: number; pageviews: number; signups: number; shares: number };

type MetricKey = 'visitors' | 'pageviews' | 'signups' | 'shares';

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'visitors', label: 'Visiteurs', color: '#7c3aed' },
  { key: 'pageviews', label: 'Pages vues', color: '#f23d82' },
  { key: 'signups', label: 'Inscriptions', color: '#e8952a' },
  { key: 'shares', label: 'Partages', color: '#16a34a' },
];

const PERIODS = [7, 14, 30] as const;

const W = 700;
const H = 220;
const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

export default function AnalyticsChart({ data }: { data: AnalyticsSeriesPoint[] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>({ visitors: true, pageviews: true, signups: true, shares: true });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo(() => data.slice(-period), [data, period]);

  const maxValue = useMemo(() => {
    let max = 1;
    for (const p of points) {
      for (const m of METRICS) {
        if (visible[m.key] && p[m.key] > max) max = p[m.key];
      }
    }
    return max;
  }, [points, visible]);

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) => PAD_LEFT + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const yFor = (v: number) => PAD_TOP + innerH - (v / maxValue) * innerH;

  const pathFor = (key: MetricKey) => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p[key]).toFixed(1)}`).join(' ');
  const areaFor = (key: MetricKey) => `${pathFor(key)} L ${xFor(points.length - 1).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} L ${xFor(0).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const x = ratio * W;
    if (points.length < 2) { setHoverIndex(points.length ? 0 : null); return; }
    const idx = Math.round(((x - PAD_LEFT) / innerW) * (points.length - 1));
    setHoverIndex(Math.min(points.length - 1, Math.max(0, idx)));
  };

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-4">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setVisible(v => ({ ...v, [m.key]: !v[m.key] }))}
              className="flex items-center gap-1.5 text-xs"
              style={{ opacity: visible[m.key] ? 1 : 0.35 }}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
              <span className="text-gray-600">{m.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setHoverIndex(null); }}
              className={`text-xs px-2.5 py-1 rounded-full ${period === p ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {p}j
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {gridLines.map(g => (
          <line
            key={g}
            x1={PAD_LEFT} x2={W - PAD_RIGHT}
            y1={PAD_TOP + innerH * (1 - g)} y2={PAD_TOP + innerH * (1 - g)}
            stroke="#eee" strokeWidth={1}
          />
        ))}
        {gridLines.map(g => (
          <text key={g} x={4} y={PAD_TOP + innerH * (1 - g) + 3} fontSize={9} fill="#aaa">
            {Math.round(maxValue * g)}
          </text>
        ))}

        {visible.visitors && points.length > 1 && (
          <path d={areaFor('visitors')} fill="#7c3aed" fillOpacity={0.08} stroke="none" />
        )}
        {METRICS.map(m => visible[m.key] && points.length > 1 && (
          <path key={m.key} d={pathFor(m.key)} fill="none" stroke={m.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {METRICS.map(m => visible[m.key] && points.length === 1 && (
          <circle key={m.key} cx={xFor(0)} cy={yFor(points[0][m.key])} r={3} fill={m.color} />
        ))}

        {hoverIndex !== null && (
          <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={PAD_TOP} y2={PAD_TOP + innerH} stroke="#ccc" strokeWidth={1} strokeDasharray="3,3" />
        )}
        {hoverIndex !== null && METRICS.map(m => visible[m.key] && (
          <circle key={m.key} cx={xFor(hoverIndex)} cy={yFor(points[hoverIndex][m.key])} r={3.5} fill={m.color} stroke="#fff" strokeWidth={1.5} />
        ))}

        {points.map((p, i) => (
          (i === 0 || i === points.length - 1 || (points.length <= 10 ? true : i % Math.ceil(points.length / 6) === 0)) && (
            <text key={p.date} x={xFor(i)} y={H - 6} fontSize={9} fill="#aaa" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
              {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
            </text>
          )
        ))}
      </svg>

      <div className="text-xs text-gray-500 mt-1 h-4">
        {hovered ? (
          <span>
            <span className="font-semibold text-gray-700">{new Date(hovered.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            {METRICS.map(m => visible[m.key] && (
              <span key={m.key} className="ml-3" style={{ color: m.color }}>{m.label} : {hovered[m.key]}</span>
            ))}
          </span>
        ) : (
          <span className="text-gray-400">Survolez le graphique pour voir le détail par jour</span>
        )}
      </div>
    </div>
  );
}
