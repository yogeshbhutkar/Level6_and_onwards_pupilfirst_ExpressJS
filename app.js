const express = require("express");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");
const app = express();
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
const flash = require("connect-flash");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");

const saltRounds = 10;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("secret"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
app.use(flash());
app.use(
  session({
    secret: "secret-key-123123123123",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      User.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(function () {
          return done(null, false, { message: "Invalid Email" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

//set ejs as view engine.

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

app.get("/", async function (request, response) {
  response.render("index", {
    title: "Todo Application",
    csrfToken: request.csrfToken(),
  });
});

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const uid = request.user.id;

      const dueToday = await Todo.dueToday(uid);
      const dueLater = await Todo.dueLater(uid);
      const overdue = await Todo.overdue(uid);
      const completed = await Todo.getCompleted(uid);
      const allTodos = await Todo.getTodos(uid);
      const username = request.user.firstName + request.user.lastName;
      if (request.accepts("html")) {
        response.render("todos", {
          dueToday,
          dueLater,
          overdue,
          completed,
          allTodos,
          username,
          csrfToken: request.csrfToken(),
          title: "My Todos",
        });
      } else {
        response.json({
          allTodos,
        });
      }
    } catch (err) {
      console.log(err);
      return response.status(422).json(err);
    }
  }
);

app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Sign Up",
    csrfToken: request.csrfToken(),
  });
});

app.get("/login", (request, response) => {
  response.render("login", {
    title: "Log in",
    csrfToken: request.csrfToken(),
  });
});

app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

app.post("/users", async (request, response) => {
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);

  try {
    if (request.body.firstName == "") {
      request.flash("error", "please provide your firstname");
      return response.redirect("/signup");
    }
    if (request.body.email == "") {
      request.flash("error", "please provide your email");
      return response.redirect("/signup");
    }
    if (request.body.password == "") {
      request.flash("error", "please enter the password");
      return response.redirect("/signup");
    }
    if (request.body.password.length < 8) {
      request.flash("error", "password must contain atleast 8 characters.");
      return response.redirect("/signup");
    }
    const user = await User.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/todos");
      }
    });
  } catch (err) {
    console.log(err);
  }
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    return response.redirect("/todos");
  }
);

app.get(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const todo = await Todo.findByPk(request.params.id);
      return response.json(todo);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.post(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    if (request.body.title.length < 5) {
      request.flash("error", "Title should contain more than 5 characters");
      return response.redirect("/todos");
    }
    if (request.body.dueDate == false) {
      request.flash("error", "Enter a valid date");
      return response.redirect("/todos");
    }
    try {
      await Todo.addTodo({
        title: request.body.title,
        dueDate: request.body.dueDate,
        userId: request.user.id,
      });
      return response.redirect("/todos");
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.put(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const todo = await Todo.findByPk(request.params.id);
      const updatedTodo = await todo.setCompletionStatus(
        request.body.completed
      );
      return response.json(updatedTodo);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    console.log("We have to delete a Todo with ID: ", request.params.id);
    try {
      await Todo.remove(request.params.id, request.user.id);
      return response.json({ success: true });
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

module.exports = app;
