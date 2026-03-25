require("dotenv").config();
console.log("ENV CHECK — RESEND_API_KEY:", process.env.RESEND_API_KEY ? "SET (" + process.env.RESEND_API_KEY.slice(0,8) + "...)" : "NOT SET");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");

const PORT = process.env.PORT || 3005;

// Initialise lazily so missing key doesn't crash on startup
let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const CONTACT_EMAIL = "ringformemories@gmail.com";

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // --------------------------------------------------
  // POST /contact — handle form submissions
  // --------------------------------------------------
  if (req.method === "POST" && req.url === "/contact") {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw);

      const { first_name, last_name, email, message } = data;

      if (!first_name || !last_name || !email || !message) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Missing required fields." }));
      }

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid email address." }));
      }

      const result = await getResend().emails.send({
        from: "Ring for Memories <no-reply@ringformemories.co.za>",
        to: CONTACT_EMAIL,
        reply_to: email,
        subject: `New enquiry from ${first_name} ${last_name}`,
        text: `Name: ${first_name} ${last_name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `
          <p><strong>Name:</strong> ${first_name} ${last_name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <hr/>
          <p>${message.replace(/\n/g, "<br/>")}</p>
        `,
      });
      if (result.error) {
        console.error("Resend error:", JSON.stringify(result.error));
        throw new Error(result.error.message || "Resend failed");
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("Contact form error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Failed to send message. Please try again." }));
    }
  }

  // --------------------------------------------------
  // Static file serving (with range request support for Safari video)
  // --------------------------------------------------
  let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  fs.stat(filePath, (err, stat) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("500 Internal Server Error");
      }
      return;
    }

    const fileSize = stat.size;
    const rangeHeader = req.headers["range"];

    if (rangeHeader) {
      // Parse range: "bytes=start-end"
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Accept-Ranges": "bytes",
        "Content-Type": contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Ring for Memories server running at http://0.0.0.0:${PORT}`);
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️  RESEND_API_KEY not set — contact form emails will fail.");
  }
});
