const Notification = require('../models/Notification');

/**
 * @desc    Get paginated customer notifications
 * @route   GET /api/v1/notifications
 * @access  Private/Customer
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;

    // Enforce max limit of 50
    if (limit > 50) limit = 50;
    if (limit < 1) limit = 20;

    const skip = (page - 1) * limit;

    const query = { userId };
    if (req.query.unreadOnly === 'true') {
      query.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get customer unread notification count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private/Customer
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/v1/notifications/:notificationId/read
 * @access  Private/Customer
 */
const markNotificationAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    // Ownership check: Customer can only mark their own notification as read
    if (notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this notification',
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all unread notifications for authenticated customer as read
 * @route   PATCH /api/v1/notifications/read-all
 * @access  Private/Customer
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        unreadCount: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
};
