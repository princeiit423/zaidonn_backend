const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Document = require("../models/Document");
const Inquiry = require("../models/Inquiry");
const Notification = require("../models/Notification");

class DatabaseStorage {

  // ================= USER =================

  async getUser(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await User.findById(id);
  }

  async getUserByUsername(username) {
    return await User.findOne({ username });
  }

  async createUser(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = new User({
      ...userData,
      password: hashedPassword,
    });

    return await user.save();
  }

  async updateUser(id, data) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    return await User.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteUser(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;

    const result = await User.findByIdAndDelete(id);
    return !!result;
  }

  async getAllClients() {
    return await User.find({ role: "client" }).sort({ createdAt: -1 });
  }

  // ================= DOCUMENT =================

  async getDocuments(clientId, category, financialYear, month) {
    const filter = {};

    if (clientId && mongoose.Types.ObjectId.isValid(clientId))
      filter.clientId = clientId;

    if (category) filter.category = category;
    if (financialYear) filter.financialYear = financialYear;
    if (month) filter.month = month;

    return await Document.find(filter).sort({ createdAt: -1 });
  }

  async getDocument(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await Document.findById(id);
  }

  async createDocument(docData) {
    const document = new Document(docData);
    return await document.save();
  }

  async deleteDocument(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;

    const result = await Document.findByIdAndDelete(id);
    return !!result;
  }

  // ================= INQUIRY =================

  async getInquiries(clientId) {
    const filter = {};

    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      filter.clientId = clientId;
    }

    return await Inquiry.find(filter).sort({ createdAt: -1 });
  }

  async getInquiry(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return await Inquiry.findById(id);
  }

  async createInquiry(inquiryData) {
    const inquiry = new Inquiry(inquiryData);
    return await inquiry.save();
  }

  async respondToInquiry(id, response) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    return await Inquiry.findByIdAndUpdate(
      id,
      {
        adminResponse: response,
        status: "responded",
        respondedAt: new Date(),
      },
      { new: true }
    );
  }

  // ================= NOTIFICATION =================

  async getNotifications(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];

    return await Notification.find({ userId }).sort({ createdAt: -1 });
  }

  async createNotification(notificationData) {
    const notification = new Notification(notificationData);
    return await notification.save();
  }

  async markNotificationRead(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;

    const result = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    return !!result;
  }

  async markAllNotificationsRead(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return false;

    await Notification.updateMany(
      { userId },
      { $set: { read: true } }
    );

    return true;
  }
}

module.exports = new DatabaseStorage();