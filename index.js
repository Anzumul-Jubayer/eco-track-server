const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
let tipsCollection;
let eventsCollection;
let userChallengesCollection;

async function run() {
  try {
    await client.connect();
    const db = client.db("ecotrack-db");

    challengesCollection = db.collection("challenges");
    tipsCollection = db.collection("tips");
    eventsCollection = db.collection("events");
    userChallengesCollection = db.collection("userChallenges");

    // Ensure unique index on userId + challengeId
    await userChallengesCollection.createIndex(
      { userId: 1, challengeId: 1 },
      { unique: true }
    );

    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

// ------------------- ROUTES -------------------

// Server check
app.get("/", (req, res) => res.send("Server is running"));

// challenges with filter
app.get("/challenges", async (req, res) => {
  try {
    const { category, startDate, endDate, participantsMin, participantsMax } =
      req.query;
    let filter = {};
    if (category) {
      const categories = category.split(",");
      filter.category = { $in: categories };
    }
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = startDate;
      if (endDate) filter.startDate.$lte = endDate;
    }
    if (participantsMin || participantsMax) {
      filter.participants = {};
      if (participantsMin) filter.participants.$gte = parseInt(participantsMin);
      if (participantsMax) filter.participants.$lte = parseInt(participantsMax);
    }
    const challenges = await challengesCollection.find(filter).toArray();
    res.json(challenges);
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

// Challenge details
app.get("/challenges/:id", async (req, res) => {
  try {
    const challenge = await challengesCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!challenge)
      return res.status(404).json({ error: "Challenge not found" });
    res.json(challenge);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch challenge" });
  }
});

// Add new challenge
app.post("/challenges-add", async (req, res) => {
  try {
    const newChallenge = req.body;

    if (!newChallenge.title || !newChallenge.description || !newChallenge.imageUrl) {
      return res
        .status(400)
        .json({ error: "Title, description, and imageUrl are required" });
    }

    
    const existing = await challengesCollection.findOne({
      $or: [
        { title: newChallenge.title },
        { description: newChallenge.description },
        { imageUrl: newChallenge.imageUrl },
      ],
    });

    if (existing) {
      return res.status(400).json({
        error: "A challenge with the same title, description, or image already exists",
      });
    }

    const now = new Date();

    const challengeToInsert = {
      ...newChallenge,
      participants: newChallenge.participants || 0,
      createdAt: now,
      updatedAt: now,
    };

    const result = await challengesCollection.insertOne(challengeToInsert);

    res.status(201).json({
      message: "✅ Challenge added successfully!",
      id: result.insertedId,
    });
  } catch (error) {
    console.error("Error adding challenge:", error);
    res.status(500).json({ error: "Failed to add challenge" });
  }
});



// Join challenge 
app.patch("/challenges-join/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const challengeId = new ObjectId(id);
    const now = new Date();
    const result = await userChallengesCollection.updateOne(
      { userId, challengeId },
      {
        $setOnInsert: {
          status: "Not Started",
          progress: 0,
          joinDate: now,
          lastUpdated: now,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      await challengesCollection.updateOne(
        { _id: challengeId },
        { $inc: { participants: 1 }, $set: { updatedAt: now } }
      );
      return res.status(200).json({ message: "Successfully joined!" });
    } 
    res.json({ message: "Already joined" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to join challenge" });
  }
});

// Update progress
app.patch("/user-challenges/:id/progress", async (req, res) => {
  try {
    const { progress, status } = req.body;
    const updateData = { lastUpdated: new Date() };
    if (progress !== undefined) updateData.progress = progress;
    if (status) updateData.status = status;

    const result = await userChallengesCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0)
      return res.status(404).json({ error: "Record not found" });

    res.json({ message: "Progress updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// Get user's challenges
app.get("/user-challenges/:userId", async (req, res) => {
  try {
    const records = await userChallengesCollection
      .find({ userId: req.params.userId })
      .toArray();
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user challenges" });
  }
});

// my-activities
app.get("/my-activities/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const result = await userChallengesCollection.aggregate([
      {
        $match: { userId: email },
      },
      {
        $lookup: {
          from: "challenges",
          localField: "challengeId",
          foreignField: "_id",
          as: "challengeData",
        },
      },
      {
        $unwind: "$challengeData",
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          challengeId: 1,
          progress: 1,
          status: 1,
          challengeTitle: "$challengeData.title", 
          category: "$challengeData.category",
          duration: "$challengeData.duration",
          target: "$challengeData.target",
        },
      },
    ]).toArray();

    res.send(result);
  } catch (error) {
    console.error("❌ Error fetching user activities:", error);
    res.status(500).send({ message: "Server error" });
  }
});


// Stats
app.get("/statistics", async (req, res) => {
  try {
    const challenges = await challengesCollection.find({}).toArray();
    let totalParticipants = 0,
      impactTotals = {};

    challenges.forEach((c) => {
      totalParticipants += c.participants || 0;
      if (c.impactMetric?.unit && c.impactMetric?.value) {
        if (!impactTotals[c.impactMetric.unit])
          impactTotals[c.impactMetric.unit] = 0;
        impactTotals[c.impactMetric.unit] += c.impactMetric.value;
      }
    });

    res.json({ totalParticipants, impactTotals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Recent tips
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

// Upcoming events
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
});

app.listen(port, () =>
  console.log(`EcoTrack server listening on port ${port}`)
);
