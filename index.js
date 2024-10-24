const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.get("/", (_, res) => {
  res.status(200).send("Welcome to Rocket Backend");
});

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "test123";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

function formatFieldName(fieldName) {
  const words = fieldName.replace(/_/g, " ").split(" ");

  const formattedWords = words.map((word, index) => {
    return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  });
  return formattedWords.join(" ");
}

function getCurrentDateTime() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object === "page") {
    try {
      for (const entry of body.entry) {
        const webhookEvent = entry.changes[0];

        const leadgenId = webhookEvent.value.leadgen_id;
        const pageId = webhookEvent.value.page_id;
        const formId = webhookEvent.value.form_id;
        const createdTime = webhookEvent.value.created_time;

        db.collection("R_Associates")
          .where("linked_facebook_pages", "array-contains", pageId)
          .get()
          .then(async (snapshot) => {
            if (snapshot.empty) {
              console.log("No matching documents.");
              return;
            }
            let associateDoc;
            let associateDocId;
            snapshot.forEach((doc) => {
              associateDocId = doc.id;
              associateDoc = doc.data();
            });
            if (associateDoc) {
              try {
                const leadDetails = await axios.get(
                  `https://graph.facebook.com/v17.0/${leadgenId}?access_token=${associateDoc.linked_facebook_page_ids[pageId].page_access_token}`
                );
                console.log("lead details: ", leadDetails.data);
                const clientDocRef = db.collection("R_Clients").doc();
                const clientDocId = clientDocRef.id;
                let client_name = "";
                let firstName = "";
                let lastName = "";
                let created_on = getCurrentDateTime();
                let noteText = "";
                let number_primary = "";
                let country_code_primary = "";
                const leadData = leadDetails.data.field_data; //leadDetails.data.field_data

                leadData.forEach((field) => {
                  if (field.name === "full_name") {
                    client_name = field.values[0];
                  } else if (field.name === "phone_number") {
                    country_code_primary = field.values[0].substring(0, 3);
                    number_primary = field.values[0].substring(3);
                  } else if (field.name === "first_name") {
                    firstName = field.values[0];
                  } else if (field.name === "last_name") {
                    lastName = field.values[0];
                  } else {
                    const formattedFieldName = formatFieldName(field.name);
                    let formattedFieldValue;
                    if (field.name !== "email") {
                      formattedFieldValue = formatFieldName(field.values[0]);
                    }
                    noteText += `<br>- ${formattedFieldName}: ${
                      formattedFieldValue ?? field.values[0]
                    }`;
                  }
                });
                if (client_name === "") {
                  client_name = `${firstName} ${lastName}`;
                }
                db.collection("R_Clients")
                  .doc(clientDocId)
                  .set({
                    assigned_to_team_member: "none",
                    added_in_group: [],
                    associate_id: associateDocId,
                    associate_reg_time: associateDoc.register_date,
                    client_is_new_for_associate_id: true,
                    country_code_primary: country_code_primary,
                    country_code_secondary: "+0",
                    client_name: client_name,
                    created_on: created_on,
                    database_id: associateDoc.database_id,
                    database_reg_time: associateDoc.database_reg_time,
                    default_whatsapp_number: "0",
                    display_name: client_name,
                    lead_source: "facebook",
                    note_by: [associateDocId],
                    note_text: [noteText],
                    number_primary: number_primary,
                    number_secondary: "0",
                    source_id: pageId,
                    source_reg_time:
                      associateDoc.linked_facebook_page_ids[pageId]
                        .page_linked_time,
                  });
                let newLeadMap = {};
                leadData.forEach((field) => {
                  newLeadMap[field.name] = field.values[0];
                });
                db.collection("leads").doc().set({
                  lead_details: newLeadMap,
                  lead_source: "facebook",
                  associate_id: associateDocId,
                  source_id: pageId,
                });
                db.collection("R_Clients_Activities")
                  .doc(clientDocId)
                  .set({
                    act_by: [],
                    act_text: [],
                    act_title: [],
                    act_type: [],
                    act_urls: [],
                    assigned_to_team_member: "none",
                    associate_id: associateDocId,
                    associate_reg_time: associateDoc.register_date,
                    database_id: associateDoc.database_id,
                    database_reg_time: associateDoc.database_reg_time,
                    client_reference: `/R_Clients/${clientDocId}`,
                  });
              } catch (fetchError) {
                console.error("Error fetching lead details:", fetchError);
              }
            }
          })
          .catch((error) => {
            console.error("Error finding document:", error);
          });
        res.sendStatus(200);
      }
    } catch (error) {
      console.error("Error handling webhook event:", error);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(404);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
