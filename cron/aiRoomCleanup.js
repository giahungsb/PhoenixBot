const cron = require("node-cron");
const AIRoomManager = require("../services/ai/AIRoomManager");

const schedule = "0 */1 * * *";

let task = null;

module.exports.start = () => {
        if (task) {
                console.log("[AIRoomCleanup] Cron job already running");
                return;
        }

        task = cron.schedule(schedule, async () => {
                console.log("[AIRoomCleanup] Running cleanup job...");
                try {
                        const result = await AIRoomManager.cleanupInactiveRooms();
                        if (result.success) {
                                console.log(`[AIRoomCleanup] Successfully cleaned ${result.cleaned} rooms`);
                        } else {
                                console.error(`[AIRoomCleanup] Cleanup failed: ${result.error}`);
                        }
                } catch (error) {
                        console.error("[AIRoomCleanup] Error in cron job:", error);
                }
        });

        console.log(`[AIRoomCleanup] Scheduled cleanup job: ${schedule} (every hour)`);
};

module.exports.stop = () => {
        if (task) {
                task.stop();
                task = null;
                console.log("[AIRoomCleanup] Cleanup job stopped");
        }
};
