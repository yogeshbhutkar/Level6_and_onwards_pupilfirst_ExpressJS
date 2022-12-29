const express = require("express");
var csrf = require("tiny-csrf");
var cookieParser = require("cookie-parser");
const app = express();
const { Todo } = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("secret"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

//set ejs as view engine.

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

app.get("/", async function (request, response) {
  try {
    const allTodos = await Todo.getTodos();
    const dueToday = await Todo.dueToday();
    const dueLater = await Todo.dueLater();
    const overdue = await Todo.overdue();
    const completed = await Todo.getCompleted();
    if (request.accepts("html")) {
      response.render("index", {
        dueToday,
        dueLater,
        overdue,
        completed,
        allTodos,
        csrfToken: request.csrfToken(),
      });
    } else {
      response.json({
        allTodos,
      });
    }
  } catch (err) {
    console.error(err);
  }
});

app.get("/todos", async function (_request, response) {
  console.log("Processing list of all Todos ...");
  try {
    const allTodoFetch = await Todo.findAll();
    response.json(allTodoFetch);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.get("/todos/:id", async function (request, response) {
  try {
    const todo = await Todo.findByPk(request.params.id);
    return response.json(todo);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.post("/todos", async function (request, response) {
  try {
    await Todo.addTodo(request.body);
    return response.redirect("/");
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.put("/todos/:id", async function (request, response) {
  const todo = await Todo.findByPk(request.params.id);
  try {
    const updatedTodo = await todo.setCompletionStatus(
      todo.completed ? false : true
    );
    return response.json(updatedTodo);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.delete("/todos/:id", async function (request, response) {
  console.log("We have to delete a Todo with ID: ", request.params.id);
  // FILL IN YOUR CODE HERE

  // First, we have to query our database to delete a Todo by ID.
  // Then, we have to respond back with true/false based on whether the Todo was deleted or not.
  // response.send(true)
  try {
    await Todo.remove(request.params.id);
    return response.json({ success: true });
  } catch (error) {
    return response.status(422).json(error);
  }
});

module.exports = app;
