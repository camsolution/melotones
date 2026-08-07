export async function getLatestVersionId(model: string): Promise<string> {
  const [owner, name] = model.split('/');
  const url = `https://api.replicate.com/v1/models/${owner}/${name}/versions`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to fetch versions: ${err.detail}`);
  }
  const data = await res.json();
  const versions = data.results;
  if (!versions || versions.length === 0) throw new Error('No versions found');
  // La première version de la liste est la plus récente
  return versions[0].id;
}
