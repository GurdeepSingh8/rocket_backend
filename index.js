const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;
const serviceAccount = require('./serviceAccountKey.json');

app.use(bodyParser.json());

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
  console.log("Received webhook: ", body);
  if (body.object === 'page') {
    try {
      for (const entry of body.entry) {
        const webhookEvent = entry.changes[0];
  
        const leadgenId = webhookEvent.value.leadgen_id;
        const pageId = webhookEvent.value.page_id;
        const formId = webhookEvent.value.form_id;
        const createdTime = webhookEvent.value.created_time;

        try {
          const leadDetails = await axios.get(`https://graph.facebook.com/v17.0/${leadgenId}?access_token=EAATyCa4F2ZA0BO3XSAeZBusNDqm3SNgOisO65WeT0IekwDGDBCwXjW15TagvrRTlxZBo5Iu0auIJGZAkbffApVJFIGQ53074mjDu560itTZCfhI6owTazuX0LxsZC02FvIMPDkFbhelpTA8aFe2WjEX0wXFA6LwmuTuYvvhjJhpOLzLZBZB7G28sQuTj2KLArk4ZD`);
          
          // Log or process the lead details
          console.log('Lead Details:', leadDetails.data);

          // You can store these lead details or forward them wherever needed
        } catch (fetchError) {
          console.error('Error fetching lead details:', fetchError);
        }
  
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