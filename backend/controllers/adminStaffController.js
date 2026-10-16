const User = require('../models/User');
const Counter = require('../models/Counter');

const createStaffUser = async (req, res, next) => {
  try {
    const { name, email, password, counterId } = req.body;
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'STAFF',
    });

    if (counterId) {
      await Counter.findByIdAndUpdate(counterId, { assignedStaffId: user._id });
    }

    res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getStaffUsers = async (req, res, next) => {
  try {
    const staff = await User.find({ role: 'STAFF' }).select('-password').lean();
    
    // Find counters assigned to these staff
    const counters = await Counter.find({ assignedStaffId: { $in: staff.map(s => s._id) } })
      .populate('organizationId', 'name')
      .populate('locationId', 'name')
      .populate('departmentId', 'name')
      .lean();
      
    const staffWithAssignments = staff.map(s => {
      const counter = counters.find(c => c.assignedStaffId?.toString() === s._id.toString());
      return {
        ...s,
        assignedCounter: counter ? {
          id: counter._id,
          name: counter.name,
          organization: counter.organizationId?.name,
          location: counter.locationId?.name,
          department: counter.departmentId?.name
        } : null
      };
    });

    res.status(200).json({ success: true, data: staffWithAssignments });
  } catch (error) {
    next(error);
  }
};

const updateStaffUser = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const { name, counterId } = req.body;

    const staff = await User.findOne({ _id: staffId, role: 'STAFF' });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    if (name) staff.name = name;
    await staff.save();

    if (counterId !== undefined) {
      // Remove staff from currently assigned counters
      await Counter.updateMany({ assignedStaffId: staff._id }, { $unset: { assignedStaffId: 1 } });
      if (counterId && counterId !== 'none') {
        await Counter.findByIdAndUpdate(counterId, { assignedStaffId: staff._id });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Staff account updated successfully',
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

const toggleStaffStatus = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const staff = await User.findOne({ _id: staffId, role: 'STAFF' });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    res.status(200).json({
      success: true,
      message: `Staff account ${staff.isActive ? 'activated' : 'deactivated'} successfully`,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createStaffUser, getStaffUsers, updateStaffUser, toggleStaffStatus };
