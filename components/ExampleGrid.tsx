import { ExampleSong } from '@/types';
import Link from 'next/link';

export default function ExampleGrid({ songs }: { songs: ExampleSong[] }) {
  if (!songs.length) return <p className="text-gray-500">No example songs found.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {songs.map((song) => (
        <div key={song.id} className="bg-white rounded shadow p-4">
          <h3 className="font-semibold text-lg">{song.title}</h3>
          <p className="text-sm text-gray-600 capitalize">{song.occasion} · {song.style}</p>
          <audio controls src={song.audio_url} className="w-full mt-2" />
          {song.description && <p className="text-sm mt-2">{song.description}</p>}
        </div>
      ))}
    </div>
  );
}
