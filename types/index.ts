export type Generation = {
  id: string;
  user_id: string;
  occasion: string;
  style: string;
  custom_message: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  audio_url: string | null;
  is_public: boolean;
  cover_url?: string | null;
  created_at: string;
};

export type ExampleSong = {
  id: string;
  title: string;
  occasion: string;
  style: string;
  audio_url: string;
  description: string | null;
  plays: number;
  cover_url?: string | null;
};
