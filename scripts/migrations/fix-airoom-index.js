const mongoose = require("mongoose");
require("dotenv").config();

async function fixAIRoomIndex() {
        try {
                await mongoose.connect(process.env.MONGO);
                console.log("✅ Connected to MongoDB");

                const db = mongoose.connection.db;
                const collection = db.collection("ziairooms");

                console.log("\n📋 Checking existing indexes...");
                const indexes = await collection.indexes();
                console.log("Current indexes:", indexes.map(i => ({ name: i.name, key: i.key })));

                const oldIndexName = "guildId_1_userId_1_status_1";
                const hasOldIndex = indexes.some(i => i.name === oldIndexName);
                
                if (hasOldIndex) {
                        console.log(`\n🗑️  Dropping old index '${oldIndexName}'...`);
                        await collection.dropIndex(oldIndexName);
                        console.log("✅ Old index dropped successfully");
                } else {
                        console.log(`\n✓  Old index '${oldIndexName}' not found, skipping`);
                }

                console.log("\n🔧 Creating new unique index on 'guildId + userId + aiModel + status'...");
                await collection.createIndex(
                        { guildId: 1, userId: 1, aiModel: 1, status: 1 }, 
                        { unique: true, partialFilterExpression: { status: "active" } }
                );
                console.log("✅ New index created successfully");

                console.log("\n📋 Final indexes:");
                const finalIndexes = await collection.indexes();
                console.log(finalIndexes.map(i => ({ name: i.name, key: i.key })));

                console.log("\n✅ Database index fix completed successfully!");
                console.log("ℹ️  Users can now create multiple AI rooms with different models (groq, gpt5, etc.)");
                
        } catch (error) {
                console.error("❌ Error:", error.message);
                if (error.code === 11000) {
                        console.error("\n⚠️  Duplicate key error detected.");
                        console.error("This might mean there are active AI rooms with duplicate keys.");
                        console.error("Consider cleaning up old rooms first with AIRoomManager.cleanupInactiveRooms()");
                }
        } finally {
                await mongoose.connection.close();
                console.log("\n🔌 Database connection closed");
        }
}

fixAIRoomIndex();
