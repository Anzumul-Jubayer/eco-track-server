const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = 3000;

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

let challengesCollection;

async function run() {
  try {
    await client.connect();
    const db = client.db("ecotrack-db"); 
    challengesCollection = db.collection("challenges"); 
    tipsCollection=db.collection('tips')
    eventsCollection=db.collection('events')
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

// Routes
app.get("/", (req, res) => {
  res.send("Server is running");
});

// challenges
app.get("/challenges", async (req, res) => {
  try {
    const allChallenges = await challengesCollection.find({}).toArray();
    res.json(allChallenges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

// active-challenges
app.get("/challenges-active", async (req, res) => {
  try {
    
    const today = new Date().toISOString().split("T")[0]; 

    const activeChallenges = await challengesCollection
      .find({
        startDate: { $lte: today },
        endDate: { $gte: today },
      })
      .toArray();

    res.json(activeChallenges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch active challenges" });
  }
});


// live statistics
app.get("/statistics", async (req, res) => {
  try {
    const challenges = await challengesCollection.find({}).toArray();

    let totalParticipants = 0;
    let impactTotals = {};

    challenges.forEach((c) => {
      totalParticipants += c.participants || 0;

      if (c.impactMetric && c.impactMetric.unit && c.impactMetric.value) {
        if (!impactTotals[c.impactMetric.unit]) impactTotals[c.impactMetric.unit] = 0;
        impactTotals[c.impactMetric.unit] += c.impactMetric.value;
      }
    });

    res.json({ totalParticipants, impactTotals });
  } catch (err) {
    console.error("Statistics error:", err);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});
// Recent Tips
app.get("/recent-tips", async (req, res) => {
  try {
    const recentTips = await tipsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    res.json(recentTips);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch recent tips" });
  }
});
// upcoming-events
app.get("/events-upcoming", async (req, res) => {
  try {
    const today = new Date();
    const upcomingEvents = await eventsCollection
      .find({ date: { $gte: today.toISOString() } })
      .sort({ date: 1 }) 
      .limit(4)
      .toArray();

    res.json(upcomingEvents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch upcoming events" });
  }
})
app.listen(port, () => {
  console.log(`EcoTrack server listening on port ${port}`);
});
