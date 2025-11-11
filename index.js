const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = 3000;
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.3w2hwbo.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect to MongoDB
async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Server is running");
});


// live statistics
app.get("/statistics", async (req, res) => {
  try {
    const db = client.db("ecotrack-db");
    const challengesCollection = db.collection("challenges");

    
    const allChallenges = await challengesCollection.find({}).toArray();
    let totalParticipants = 0;
    let totalImpact = 0;

    allChallenges.forEach((c) => {
      totalParticipants += c.participants || 0;

      
      const value = parseFloat(c.impactMetric?.match(/\d+/)?.[0] || 0);
      totalImpact += value;
    });

    res.json({
      totalParticipants,
      totalImpact,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});


app.listen(port, () => {
  console.log(`EcoTrack server listening on port ${port}`);
});
