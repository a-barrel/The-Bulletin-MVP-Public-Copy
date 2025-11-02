const mongoose = require('../server/node_modules/mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/pinpoint');
    const doc = await mongoose.connection.db.collection('proximitychatmessages').findOne({});
    console.log(JSON.stringify(doc?.author, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
})();
