const { parentPort, workerData } = require("worker_threads");
const { RankCardBuilder, Font } = require("canvacord");

async function buildImage(rankCard_data) {
        const { memberData, userDB, sss, strimg, status, colorr, avtaURL } = rankCard_data;
        const coinValue = userDB?.coin || 0;
        const coinText = coinValue < 0 ? `bạn nợ ngân hàng ${Math.abs(coinValue)} xu` : `${coinValue} xu`;
        Font.loadDefault();
        const rankCard = new RankCardBuilder()
                .setAvatar(avtaURL)
                .setUsername(coinText)
                .setCurrentXP(userDB?.xp || 0)
                .setLevel(userDB?.level || 1)
                .setRequiredXP((userDB?.level || 1) * 50 + 1)
                .setProgressCalculator(() => Math.floor(((userDB?.xp || 0) / ((userDB?.level || 1) * 50 + 1)) * 100))
                .setStatus(status)
                .setDisplayName(memberData?.tag || memberData?.nickname || memberData?.username, colorr)
                .setBackground(strimg)
                .setRank(sss + 1)
                .setOverlay(15.5)
                .setStyles({
                        progressbar: {
                                thumb: {
                                        style: {
                                                backgroundColor: colorr,
                                        },
                                },
                        },
                        username: {
                                name: {
                                        style: {
                                                color: colorr,
                                        },
                                },
                        },
                        statistics: {
                                level: {
                                        text: {
                                                style: {
                                                        color: colorr,
                                                },
                                        },
                                        value: {
                                                style: {
                                                        color: colorr,
                                                },
                                        },
                                },
                                xp: {
                                        text: {
                                                style: {
                                                        color: colorr,
                                                },
                                        },
                                        value: {
                                                style: {
                                                        color: colorr,
                                                },
                                        },
                                },
                                rank: {
                                        text: {
                                                style: {
                                                        color: colorr,
                                                },
                                        },
                                        value: {
                                                style: {
                                                        color: colorr,
                                                },
                                        },
                                },
                        },
                });

        const buffer = await rankCard.build({ format: "png" });
        parentPort.postMessage(buffer.buffer); // Send as ArrayBuffer
}

// Listen for termination signal
parentPort.on("message", (message) => {
        if (message === "terminate") {
                process.exit(0); // Gracefully exit
        }
});

buildImage(workerData.rankCard_data).catch((error) => {
        console.error("Error in worker:", error);
        process.exit(1);
});
