require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const helmet = require("helmet");
const { body, validationResult } = require("express-validator");

const db = require("./database");

const app = express();

// Settings
app.set("view engine", "ejs");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(helmet());

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: "./"
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3600000,
      httpOnly: true,
      sameSite: "strict"
    }
  })
);

// Flash Messages
app.use((req, res, next) => {
  res.locals.error = req.session.error;
  res.locals.success = req.session.success;

  delete req.session.error;
  delete req.session.success;

  next();
});

// Home page
app.get("/", (req, res) => {
  res.render("home");
});

// Register page
app.get("/register", (req, res) => {
  res.render("register");
});

// Register user
app.post(
  "/register",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required"),

    body("email")
      .isEmail()
      .withMessage("Enter a valid email"),

    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
  ],

  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        req.session.error =
          errors.array().map(error => error.msg).join(", ");

        return res.redirect("/register");
      }

      const { name, email, password, confirmPassword } = req.body;

      if (!name || !email || !password || !confirmPassword) {
        req.session.error = "All fields are required";
        return res.redirect("/register");
      }

      if (password !== confirmPassword) {
        req.session.error = "Passwords do not match";
        return res.redirect("/register");
      }

      const strongPassword =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

      if (!strongPassword.test(password)) {
        req.session.error =
          "Password must contain uppercase, lowercase and a number";

        return res.redirect("/register");
      }

      db.get(
        "SELECT * FROM users WHERE email = ?",
        [email],

        async (err, user) => {
          if (err) {
            req.session.error = "Database error";
            return res.redirect("/register");
          }

          if (user) {
            req.session.error = "Email already exists";
            return res.redirect("/register");
          }

          const hashedPassword = await bcrypt.hash(password, 10);

          db.run(
            "INSERT INTO users (name,email,password) VALUES (?,?,?)",
            [name, email, hashedPassword],

            function (err) {
              if (err) {
                req.session.error = "Registration failed";
                return res.redirect("/register");
              }

              req.session.success =
                "Registration successful. Please login.";

              res.redirect("/login");
            }
          );
        }
      );
    } catch (error) {
      console.log(error);

      req.session.error = "Something went wrong";
      res.redirect("/register");
    }
  }
);

// Login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Login user
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],

    async (err, user) => {
      if (err) {
        req.session.error = "Database error";
        return res.redirect("/login");
      }

      if (!user) {
        req.session.error = "Invalid email or password";
        return res.redirect("/login");
      }

      const match = await bcrypt.compare(
        password,
        user.password
      );

      if (!match) {
        req.session.error = "Invalid email or password";
        return res.redirect("/login");
      }

    //  req.session.userId = user.id;
    //  req.session.userName = user.name;

    //  res.redirect("/dashboard");

    const otp = Math.floor(100000 + Math.random() * 900000);

    req.session.otp = otp;

    req.session.tempUserId = user.id;

    req.session.tempUserName = user.name;

    console.log("OTP:", otp);

    res.redirect("/otp");
    }
  );
});

//otp
app.get("/otp", (req, res) => {
  res.render("otp");
});

app.post("/otp", (req, res) => {

  if (req.body.otp == req.session.otp) {

    req.session.userId =
      req.session.tempUserId;

    req.session.userName =
      req.session.tempUserName;

    delete req.session.otp;

    delete req.session.tempUserId;

    delete req.session.tempUserName;

    return res.redirect("/dashboard");
  }

  req.session.error = "Invalid OTP";

  res.redirect("/otp");
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  res.render("dashboard", {
    name: req.session.userName
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});