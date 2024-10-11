const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');


const app = express();
const port = process.env.PORT || 3000;
const serviceAccount = require('./serviceAccountKey.json');

app.use(bodyParser.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'test123';

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.get('/test', (req, res) => {
  res.status(200).send("get request successfull");
})

app.post('/submit', (req, res) => {
  const name = req.body.name;

  res.status(200).send({"name": name});
})

app.post('/webhook', async (req, res) => {
  const body = req.body; 
  console.log("Received webhook");
  if (body.object === 'page') {
    try {
      for (const entry of body.entry) {
        const webhookEvent = entry.changes[0];
  
        const leadgenId = webhookEvent.value.leadgen_id;
        const pageId = webhookEvent.value.page_id;
        const formId = webhookEvent.value.form_id;
        const createdTime = webhookEvent.value.created_time;
  
        // const leadRef = admin.firestore().collection('leads').doc(leadgenId);
  
        // await leadRef.set({
        //   leadgen_id: leadgenId,
        //   page_id: pageId,
        //   form_id: formId,
        //   created_time: new Date(createdTime * 1000).toISOString()
        // });
  
        console.log('Webhook Event:', webhookEvent);
        res.status(200).send('EVENT_RECEIVED');
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.sendStatus(404);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});