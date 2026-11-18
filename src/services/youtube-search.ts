export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

interface YouTubeSearchResponse {
  items?: {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
      };
    };
  }[];
  error?: {
    message?: string;
    errors?: { reason?: string }[];
  };
}

const searchCache = new Map<string, YouTubeVideoResult[]>();

export async function searchYouTubeVideos(
  query: string,
  signal?: AbortSignal,
): Promise<YouTubeVideoResult[]> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Automatic YouTube search is not configured. Add VITE_YOUTUBE_API_KEY to .env and restart Sonora.',
    );
  }

  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  if (!normalizedQuery) throw new Error('Add a song title and artist to search YouTube.');

  const cacheKey = normalizedQuery.toLocaleLowerCase();
  const cachedResults = searchCache.get(cacheKey);
  if (cachedResults) return cachedResults;

  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    maxResults: '5',
    q: normalizedQuery,
  });
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    signal ? { signal } : {},
  );

  let payload: YouTubeSearchResponse;
  try {
    payload = (await response.json()) as YouTubeSearchResponse;
  } catch {
    throw new Error('YouTube search returned an invalid response.');
  }

  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new Error('YouTube search quota is exhausted. Try again later.');
    }
    if (response.status === 403 || reason === 'keyInvalid' || reason === 'accessNotConfigured') {
      throw new Error(
        'YouTube search is not authorized. Check the API key restrictions and enable YouTube Data API v3.',
      );
    }
    throw new Error(payload.error?.message || `YouTube search failed (${response.status}).`);
  }

  const results = (payload.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId?.trim();
      const title = item.snippet?.title?.trim();
      if (!videoId || !title) return null;
      return {
        videoId,
        title,
        channelTitle: item.snippet?.channelTitle?.trim() || 'YouTube channel',
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      };
    })
    .filter((result): result is YouTubeVideoResult => result !== null);

  if (!signal?.aborted) searchCache.set(cacheKey, results);
  return results;
}
