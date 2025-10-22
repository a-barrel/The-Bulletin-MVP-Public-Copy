const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { loadSampleData } = require('./utils/sampleDataLoader');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pinpoint');

  await loadSampleData({ dropExisting: true, logger: console });

  console.log('Sample data inserted successfully.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed script failed:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
