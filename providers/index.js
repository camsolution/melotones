const MurekaProvider = require('./MurekaProvider');
const SunoProvider = require('./SunoProvider');

function getProvider(providerName) {
  switch (providerName) {
    case 'mureka':
      return new MurekaProvider(process.env.MUREKA_API_KEY);
    case 'suno':
      return new SunoProvider(
        process.env.SUNO_WRAPPER_API_KEY,
        process.env.SUNO_WRAPPER_BASE_URL
      );
    default:
      throw new Error(`Provider inconnu: "${providerName}"`);
  }
}

function getDefaultProvider() {
  const name = process.env.MELOTONES_DEFAULT_PROVIDER || 'mureka';
  return getProvider(name);
}

module.exports = { getProvider, getDefaultProvider };

