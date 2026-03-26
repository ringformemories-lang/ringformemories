const RESEND_KEY = process.env.RESEND_API_KEY;
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");

const PORT = process.env.PORT || 3005;

// Initialise lazily so missing key doesn't crash on startup
let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(RESEND_KEY);
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

// Security headers applied to every response
function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; " +
    "media-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
}

// Sanitise a string for safe inclusion in HTML email
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);

  // --------------------------------------------------
  // POST /contact — handle form submissions
  // --------------------------------------------------
  if (req.method === "POST" && req.url.split("?")[0] === "/contact") {
    try {
      // Limit body size to 10KB to prevent DoS
      const raw = await new Promise((resolve, reject) => {
        let body = "";
        let size = 0;
        req.on("data", (chunk) => {
          size += chunk.length;
          if (size > 10240) { req.destroy(); return reject(new Error("Payload too large")); }
          body += chunk.toString();
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
      });

      const data = JSON.parse(raw);
      const { first_name, last_name, email, message } = data;

      // Input validation
      if (!first_name || !last_name || !email || !message) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Missing required fields." }));
      }

      // Length limits
      if (first_name.length > 100 || last_name.length > 100 || email.length > 254 || message.length > 5000) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Input exceeds maximum length." }));
      }

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid email address." }));
      }

      // Sanitise inputs before use in HTML email
      const safeName = escapeHtml(`${first_name} ${last_name}`);
      const safeEmail = escapeHtml(email);
      const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");

      const result = await getResend().emails.send({
        from: "Ring for Memories <no-reply@ringformemories.co.za>",
        to: CONTACT_EMAIL,
        reply_to: email,
        subject: `New enquiry from ${escapeHtml(first_name)} ${escapeHtml(last_name)}`,
        text: `Name: ${first_name} ${last_name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
          <hr/>
          <p>${safeMessage}</p>
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
  const urlPath = req.url.split("?")[0];

  // Path traversal protection — resolve and confirm it stays within project root
  const safePath = path.normalize(urlPath === "/" ? "/index.html" : urlPath);
  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    return res.end("403 Forbidden");
  }

  // Block direct access to sensitive server-side files
  const blocked = [".env", "server.js", "package.json", "package-lock.json", "railway.toml", ".gitignore", ".dockerignore"];
  const basename = path.basename(filePath);
  if (blocked.includes(basename)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    return res.end("403 Forbidden");
  }

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

    // Block directory traversal to folders
    if (stat.isDirectory()) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      return res.end("403 Forbidden");
    }

    const fileSize = stat.size;
    const rangeHeader = req.headers["range"];

    if (rangeHeader) {
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
  console.log("Resend key source:", process.env.RESEND_API_KEY ? "env var" : "fallback hardcoded");
});
