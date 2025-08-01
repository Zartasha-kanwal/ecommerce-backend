const port = 4000;
require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5176",
      "https://ecommerce-frontend-bice-rho.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const { type } = require("os");

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "upload/images")));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Database connection
mongoose.connect(
  "mongodb+srv://zartashakanwal:zari.147@cluster0.iyr9rqa.mongodb.net/ecommerce"
);

// API root
app.get("/", (req, res) => {
  res.send("Express App is running");
});

/// Temporary Multer upload setup
const upload = multer({ dest: "temp/" });

app.post("/upload", upload.single("product"), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "ecommerce-products", // optional
    });

    fs.unlinkSync(req.file.path); // clean up temp file

    res.json({
      success: 1,
      image_url: result.secure_url, // ← save this in your DB
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    res.status(500).json({ success: 0, message: "Upload failed" });
  }
});

//Schema
const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  new_price: { type: Number, required: true },
  old_price: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true },
});

app.post("/addproduct", async (req, res) => {
  try {
    let products = await Product.find({});
    let id;
    if (products.length > 0) {
      let last_product_array = products.slice(-1);
      let last_product = last_product_array[0];
      id = last_product.id + 1;
    } else {
      id = 1;
    }

    const newProduct = new Product({
      id: id,
      name: req.body.name,
      image: req.body.image,
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });

    console.log(newProduct);
    await newProduct.save();
    console.log("saved");

    res.json({
      success: true,
      name: req.body.name,
    });
  } catch (err) {
    console.error("Error saving product:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

//Creating Api for Deleting Product
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({
    id: req.body.id,
  });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  });
});

//Creating API for Getting all Products
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("All products fetched");
  res.send(products);
});

//Schema Creating for User Model
const Users = mongoose.model("Users", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

//Creating Endpoint For registring the User
app.post("/signup", async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: false,
      errors: "Existing User found with same email address",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();
  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

//Creating Endpoint for User Login
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong Password" });
    }
  } else {
    res.json({ success: false, errors: "Wrong Email Id" });
  }
});

//Creating EndPoint for New Collection Data
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("New collection fetched");
  res.send(newcollection);
});

//Creating Endpoint For Popular in Women Section
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let popular_in_women = products.slice(0, 4);
  console.log("Popular in women Fetched");
  res.send(popular_in_women);
});

//Creating Midlleware to Fetch user
const fetchUser = (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ errors: "Please Authenticate using Valid token" });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (error) {
      res.status(401).send({ errors: "Please Authenticate using Valid token" });
    }
  }
};

//Creating Endpoint For Adding product in Cartdata
app.post("/addtocart", fetchUser, async (req, res) => {
  try {
    const itemId = req.body.itemId;
    const userId = req.user.id;

    let user = await Users.findById(userId);

    // Make sure cartData exists
    if (!user.cartData) {
      user.cartData = {};
    }

    // Make sure the itemId is initialized
    if (!user.cartData[itemId]) {
      user.cartData[itemId] = 0;
    }

    user.cartData[itemId] += 1;

    // Only update the one field, not overwrite whole cart
    await Users.updateOne(
      { _id: userId },
      { $set: { [`cartData.${itemId}`]: user.cartData[itemId] } }
    );

    res.json({ success: true, cartData: user.cartData });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ success: false, message: "Add to cart failed" });
  }
});

//Creating Endpoint for removing product from Cart data

app.post("/removefromcart", fetchUser, async (req, res) => {
  try {
    const itemId = req.body.itemId;
    const userId = req.user.id;

    let user = await Users.findById(userId);

    if (user.cartData && user.cartData[itemId]) {
      user.cartData[itemId] = Math.max(user.cartData[itemId] - 1, 0);

      await Users.updateOne(
        { _id: userId },
        { $set: { [`cartData.${itemId}`]: user.cartData[itemId] } }
      );
    }

    res.json({ success: true, cartData: user.cartData });
  } catch (err) {
    console.error("Remove from cart error:", err);
    res
      .status(500)
      .json({ success: false, message: "Remove from cart failed" });
  }
});

//Creating Endpoint for retreiving cart data
app.get("/getcart", fetchUser, async (req, res) => {
  try {
    const user = await Users.findById(req.user.id);

    if (!user.cartData) {
      user.cartData = {};
    }

    res.json({ cartItems: user.cartData });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ success: false, message: "Failed to get cart" });
  }
});

app.listen(port, (error) => {
  if (!error) {
    console.log("Server running on Port " + port);
  } else {
    console.log("Error: " + error);
  }
});
