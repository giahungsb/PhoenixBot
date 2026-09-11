const mongoose = require("mongoose");
require("dotenv").config();

async function fixGuildIndex() {
        try {
                await mongoose.connect(process.env.MONGO);
                console.log("✅ Connected to MongoDB");

                const db = mongoose.connection.db;
                const collection = db.collection("ziguilds");

                console.log("\n📋 Checking existing indexes...");
                const indexes = await collection.indexes();
                console.log("Current indexes:", indexes.map(i => i.name));

                const hasOldIndex = indexes.some(i => i.name === "guild_id_1");
                
                if (hasOldIndex) {
                        console.log("\n🗑️  Dropping old index 'guild_id_1'...");
                        await collection.dropIndex("guild_id_1");
                        console.log("✅ Old index dropped successfully");
                } else {
                        console.log("\n✓  Old index 'guild_id_1' not found, skipping");
                }

                console.log("\n🔧 Creating new unique index on 'guildId'...");
                await collection.createIndex({ guildId: 1 }, { unique: true });
                console.log("✅ New index created successfully");

                console.log("\n📋 Final indexes:");
                const finalIndexes = await collection.indexes();
                console.log(finalIndexes.map(i => ({ name: i.name, key: i.key })));

                console.log("\n✅ Database fix completed successfully!");
                
        } catch (error) {
                console.error("❌ Error:", error.message);
                if (error.code === 11000) {
                        console.error("\n⚠️  Duplicate key error detected.");
                        console.error("This might mean there are documents with duplicate guildId values.");
                        console.error("Please check your data manually.");
                }
        } finally {
                await mongoose.connection.close();
                console.log("\n🔌 Database connection closed");
        }
}

fixGuildIndex();
