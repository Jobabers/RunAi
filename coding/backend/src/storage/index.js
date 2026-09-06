const config = require('../config');

if (config.storageDriver === 'supabase') {
  module.exports = require('./supabaseStore');
} else {
  module.exports = require('./memoryStore');
}
