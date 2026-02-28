const session = require("express-session");
const multer = require("multer");
const { createServer } = require("http");
const bcrypt = require("bcryptjs");
const { v2: cloudinary } = require("cloudinary");
const storage = require("../storage/storage");
const generateToken = require("../utils/generateToken");
//const { requireAuth, requireAdmin } = require("../middlewares/auth");
const auth = require("../middlewares/auth");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

//function requireAuth(req, res, next) {
//  if (!req.session.userId) {
//    return res.status(401).json({ message: "Unauthorized" });
//  }
//  next();
//}

//function requireAdmin(req, res, next) {
//  if (!req.session.userId || req.session.role !== "admin") {
//    return res.status(403).json({ message: "Forbidden" });
//  }
//  next();
// }

//async function seedAdmin() {
//  const existing = await storage.getUserByUsername("admin");
//  if (!existing) {
//    await storage.createUser({
//      username: "zaidonn",
//      password: "consult123",
//     name: "Administrator",
//    role: "admin",
//    email: "zntax2023@gmail.com",
//  });
//  console.log("Default admin created: admin / admin123");
// }
// }

async function registerRoutes(app) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "zaidonn-secret-key-2024",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    }),
  );

  // await seedAdmin();

  // ================= AUTH =================

   app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await storage.getUserByUsername(username);
      if (!user)
        return res.status(401).json({ message: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid)
        return res.status(401).json({ message: "Invalid credentials" });

      const token = generateToken(user);

      const safeUser = user.toObject();
      delete safeUser.password;

      res.json({ user: safeUser, token });

    } catch (err) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", auth, async (req, res) => {
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    const safeUser = user.toObject();
    delete safeUser.password;

    res.json(safeUser);
  });
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  // ================= CLIENTS =================

  app.get("/api/clients", auth, async (req, res) => {
    const clients = await storage.getAllClients();
    const safe = clients.map((c) => {
      const obj = c.toObject();
      delete obj.password;
      return obj;
    });
    res.json(safe);
  });

  app.post("/api/clients", auth, async (req, res) => {
    try {
      const {
        username,
        password,
        name,
        email,
        phone,
        businessName,
        gstNumber,
        panNumber,
      } = req.body;

      if (!username || !password || !name) {
        return res
          .status(400)
          .json({ message: "Username, password, and name required" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const client = await storage.createUser({
        username,
        password,
        name,
        role: "client",
        email,
        phone,
        businessName,
        gstNumber,
        panNumber,
      });

      await storage.createNotification({
        userId: client._id,
        title: "Welcome to ZAIDONN Portal",
        message: "Your account has been created.",
        type: "info",
      });

      const safe = client.toObject();
      delete safe.password;

      res.status(201).json(safe);
    } catch {
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", auth, async (req, res) => {
    const updated = await storage.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Client not found" });

    const safe = updated.toObject();
    delete safe.password;

    res.json(safe);
  });

  app.delete("/api/clients/:id", auth, async (req, res) => {
    const deleted = await storage.deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Client not found" });

    res.json({ message: "Client deleted" });
  });

  // ================= DOCUMENTS =================

  app.get("/api/documents", auth, async (req, res) => {
    const { clientId, category, financialYear, month } = req.query;

    const cid = req.user.role === "admin" ? clientId : req.user.id;

    const docs = await storage.getDocuments(
      cid,
      category,
      financialYear,
      month,
    );
    res.json(docs);
  });

  app.post(
    "/api/documents/upload",
    auth,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const { clientId, category, subcategory, name, financialYear, month } =
          req.body;

        const originalName = decodeURIComponent(req.file.originalname);
        const extension = originalName.split(".").pop();

        const publicIdWithoutExt = originalName
          .split(".")
          .slice(0, -1)
          .join(".");

        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `zaidonn/${category}`,
              resource_type: "raw",
              public_id: `${publicIdWithoutExt}.${extension}`, // 🔥 THIS FIX
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          );
          stream.end(req.file.buffer);
        });

        const doc = await storage.createDocument({
          clientId,
          category,
          subcategory: subcategory || null,
          name,
          financialYear: financialYear || null,
          month: month || null,
          cloudinaryUrl: result.secure_url,
          cloudinaryPublicId: result.public_id,
          uploadedBy: req.user.id,
        });

        res.status(201).json(doc);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Upload failed" });
      }
    },
  );

  app.delete("/api/documents/:id", auth, async (req, res) => {
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    await cloudinary.uploader.destroy(doc.cloudinaryPublicId);
    await storage.deleteDocument(req.params.id);

    res.json({ message: "Document deleted" });
  });

  // ================= INQUIRIES =================

  app.get("/api/inquiries", auth, async (req, res) => {
    //const clientId = req.user.id;
      const clientId = req.user.role === "admin" ? undefined : req.user.id
    const list = await storage.getInquiries(clientId);
    res.json(list);
  });

  app.post("/api/inquiries", auth, async (req, res) => {
    const { subject, message } = req.body;

    const user = await storage.getUser(req.user.id);

    const inquiry = await storage.createInquiry({
      clientId: req.user.id,
      clientName: user?.name || "Unknown",
      subject,
      message,
    });

    res.status(201).json(inquiry);
  });

  app.put("/api/inquiries/:id/respond", auth, async (req, res) => {
  const { response } = req.body;
  const inquiry = await storage.respondToInquiry(req.params.id, response);
  if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

  // ✅ AUTO NOTIFY CLIENT — inquiry answered
  await storage.createNotification({
    userId: inquiry.clientId,
    title: "Your Inquiry Has Been Answered",
    message: `Admin has responded to your inquiry: "${inquiry.subject}"`,
    type: "inquiry",
  });

  res.json(inquiry);
});
  // ================= NOTIFICATIONS =================

  app.get("/api/notifications", auth, async (req, res) => {
    const list = await storage.getNotifications(req.user.id);
    res.json(list);
  });

  app.put("/api/notifications/:id/read", auth, async (req, res) => {
    await storage.markNotificationRead(req.params.id);
    res.json({ message: "Marked as read" });
  });

  app.put("/api/notifications/read-all", auth, async (req, res) => {
    await storage.markAllNotificationsRead(req.user.id);
    res.json({ message: "All marked as read" });
  });

  app.post("/api/notifications", auth, async (req, res) => {
    const { userId, title, message, type } = req.body;

    const notification = await storage.createNotification({
      userId,
      title,
      message,
      type: type || "info",
    });

    res.status(201).json(notification);
  });

  return createServer(app);
}

module.exports = registerRoutes;
