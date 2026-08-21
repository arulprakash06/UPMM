const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/status", (req, res) => {
    res.json({
        app: "UPM",
        name: "Universal Patient Monitoring",
        status: "online"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`UPM running on port ${PORT}`);
});