
require("dotenv").config();
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  description: String,
  image: String,
  price: Number,
  originalPrice: Number,
  stock: Number
});

const Product = mongoose.model("Product", productSchema);

const products = [
  {
    name: "Wireless Headphones",
    category: "Electronics",
    price: 2999,
    originalPrice: 3999,
    stock: 20,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Smart Watch",
    category: "Electronics",
    price: 3999,
    originalPrice: 4999,
    stock: 15,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Casual Sneakers",
    category: "Fashion",
    price: 2099,
    originalPrice: 2999,
    stock: 25,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Digital Camera",
    category: "Electronics",
    price: 24999,
    originalPrice: 29999,
    stock: 5,
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Modern Table Lamp",
    category: "Home",
    price: 1499,
    originalPrice: 1999,
    stock: 10,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Skincare Essentials",
    category: "Beauty",
    price: 899,
    originalPrice: 1199,
    stock: 30,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Programming Books",
    category: "Books",
    price: 699,
    originalPrice: 899,
    stock: 40,
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Football",
    category: "Sports",
    price: 999,
    originalPrice: 1299,
    stock: 18,
    image: "https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?auto=format&fit=crop&w=600&q=80"
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Refresh only the sample product catalogue.
    await Product.deleteMany({});
    await Product.insertMany(products);

    console.log("Sample products inserted successfully.");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedDatabase();
