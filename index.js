const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const xhub = require('express-x-hub');


const app = express();
const port = process.env.PORT || 3000;
const serviceAccount = require('./serviceAccountKey.json');

app.use(bodyParser.json());
app.use(xhub({ algorithm: 'sha1', secret: "20a672ab50e4c772151641b4a3be76e3" }));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.get('/', (req, res) => {
  res.status(200).send("Welcome to Rocket Backend");
})
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

app.post('/webhook', async (req, res) => {
  const body = req.body; 
  console.log("Received webhook");
  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }
  console.log('request header X-Hub-Signature validated');
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
        res.sendStatus(200);
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(404);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});