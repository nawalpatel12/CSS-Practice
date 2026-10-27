
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5500"
}));
app.use(express.json({ limit: "20kb" }));

// -------------------- DATABASE MODELS --------------------

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  description: { type: String, default: "" },
  image: { type: String, default: "" },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, default: 0, min: 0 },
  stock: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true, select: false }
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: String,
    price: Number,
    quantity: { type: Number, min: 1, required: true }
  }],
  total: { type: Number, required: true },
  shippingAddress: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"],
    default: "Pending"
  }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

// -------------------- AUTHENTICATION --------------------

function createToken(user) {
  return jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired login token."
    });
  }
}

// -------------------- BASIC ROUTES --------------------

app.get("/", (req, res) => {
  res.json({ message: "ShopZone API is running!" });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected"
  });
});

// -------------------- PRODUCTS --------------------

// GET /api/products
// Examples:
// /api/products?search=watch
// /api/products?category=Electronics

app.get("/api/products", async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.category && req.query.category !== "All") {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      filter.name = {
        $regex: req.query.search.slice(0, 80),
        $options: "i"
      };
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(products);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id
app.get("/api/products/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// -------------------- REGISTER --------------------

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 80 ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Enter a valid name and email, and a password of 8–128 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    res.status(201).json({
      message: "Account created successfully.",
      token: createToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered."
      });
    }
    next(error);
  }
});

// -------------------- LOGIN --------------------

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Enter your email and password."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Incorrect email or password."
      });
    }

    res.json({
      message: "Login successful.",
      token: createToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// -------------------- CREATE ORDER --------------------

app.post("/api/orders", authenticate, async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { items, shippingAddress } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50 ||
      typeof shippingAddress !== "string" ||
      shippingAddress.trim().length < 5 ||
      shippingAddress.trim().length > 500
    ) {
      return res.status(400).json({
        message: "Provide valid order items and shipping address."
      });
    }

    const quantities = new Map();

    for (const item of items) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        return res.status(400).json({
          message: "Invalid product or quantity."
        });
      }

      const id = item.productId;
      quantities.set(id, (quantities.get(id) || 0) + item.quantity);

      if (quantities.get(id) > 100) {
        return res.status(400).json({
          message: "Quantity per product cannot exceed 100."
        });
      }
    }

    let order;

    await session.withTransaction(async () => {
      const orderItems = [];
      let total = 0;

      for (const [id, quantity] of quantities) {
        // Reserve stock atomically; reject insufficient inventory.
        const product = await Product.findOneAndUpdate(
          { _id: id, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );

        if (!product) {
          throw new Error("PRODUCT_UNAVAILABLE");
        }

        orderItems.push({
          product: product._id,
          name: product.name,
          price: product.price,
          quantity
        });

        total += product.price * quantity;

        if (!Number.isSafeInteger(total) || total > 1000000000) {
          throw new Error("ORDER_TOTAL_INVALID");
        }
      }

      [order] = await Order.create([{
        user: req.user.id,
        items: orderItems,
        total,
        shippingAddress: shippingAddress.trim(),
        status: "Pending"
      }], { session });
    });

    res.status(201).json({
      message: "Order created successfully.",
      order
    });
  } catch (error) {
    if (error.message === "PRODUCT_UNAVAILABLE") {
      return res.status(409).json({
        message: "A product is unavailable or has insufficient stock."
      });
    }

    if (error.message === "ORDER_TOTAL_INVALID") {
      return res.status(400).json({
        message: "Order total is invalid."
      });
    }

    next(error);
  } finally {
    await session.endSession();
  }
});

// -------------------- ORDER HISTORY --------------------

app.get("/api/orders/my", authenticate, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate("items.product", "name image")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// -------------------- ERROR HANDLER --------------------

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) return next(err);

  res.status(500).json({
    message: "Something went wrong. Please try again."
  });
});

// -------------------- START SERVER --------------------

async function startServer() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGO_URI and JWT_SECRET must be configured.");
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const port = process.env.PORT || 5000;

  app.listen(port, () => {
    console.log(`ShopZone API running at http://localhost:${port}`);
  });
}

startServer().catch(error => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
