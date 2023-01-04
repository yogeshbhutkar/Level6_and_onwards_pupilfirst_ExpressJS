const request = require("supertest");
var cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;

function extractCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Todo Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "tester",
      email: "batman@gmail.com",
      password: "123456789",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign Out", async () => {
    const agent = request.agent(server);
    await login(agent, "batman@gmail.com", "123456789");
    let res = await agent.get("/todos");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/todos");
    expect(res.statusCode).toBe(302);
  });

  test("Creates a todo and responds with json at /todos POST endpoint", async () => {
    const agent = request.agent(server);
    await login(agent, "batman@gmail.com", "123456789");
    const res = await agent.get("/todos");
    const csrfToken = extractCsrfToken(res);
    const response = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Marks a todo with the given ID as complete", async () => {
    //logging in the user.
    const agent = request.agent(server);
    await login(agent, "batman@gmail.com", "123456789");
    let res = await agent.get("/todos");
    let csrfToken = extractCsrfToken(res);
    const response = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const groupedTodosResponse = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    console.log(parsedGroupedResponse);
    const dueTodayCount = parsedGroupedResponse.allTodos.length;
    const latestTodo = parsedGroupedResponse.allTodos[dueTodayCount - 1];

    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);

    const markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: csrfToken,
        completed: true,
      });

    const parsedUpdateResponse = JSON.parse(markCompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(true);
  });

  test("Marks a todo with the given ID as incomplete", async () => {
    const agent = request.agent(server);
    await login(agent, "batman@gmail.com", "123456789");
    let res = await agent.get("/todos");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const groupedTodosResponse = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    // console.log(parsedGroupedResponse);
    const dueTodayCount = parsedGroupedResponse.allTodos.length;
    const latestTodo = parsedGroupedResponse.allTodos[dueTodayCount - 1];

    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);

    const markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: csrfToken,
        completed: true,
      });
    let parsedUpdateResponse = JSON.parse(markCompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(true);

    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);

    const markIncompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: csrfToken,
        completed: false,
      });

    parsedUpdateResponse = JSON.parse(markIncompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(false);
  });

  test("Deletes a todo with the given ID if it exists and sends a boolean response", async () => {
    const agent = request.agent(server);
    await login(agent, "batman@gmail.com", "123456789");
    const responsePost = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const parsedResponsePost = JSON.parse(responsePost.text);
    console.log(parsedResponsePost);
    expect(parsedResponsePost.allTodos.length).toBe(1);
    let resAgainAgain = await agent.get("/todos");
    let csrfTokenAgainAgain = extractCsrfToken(resAgainAgain);
    const deleteHere = await agent.delete("/todos/1").send({
      _csrf: csrfTokenAgainAgain,
    });
    const afterDelete = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const jsonifyResponse = JSON.parse(afterDelete.text);
    expect(jsonifyResponse.allTodos.length).toBe(0);
  });

  test("User A shouldn't able to update User B's todos", async () => {
    let res = await agent.get("/signup");
    let csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "testAgain",
      lastName: "testAgain",
      email: "testAgain@gmail.com",
      password: "123456789",
      _csrf: csrfToken,
    });
    //create todo
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/todos").send({
      title: "dummyText",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const FirstTodoId = res.id;
    //logout the above user
    await agent.get("/signout");
    //create another user account
    res = await agent.get("/signup");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "testAgainAgain",
      lastName: "Again",
      email: "dummyemail@email.com",
      password: "123456789",
      _csrf: csrfToken,
    });
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    const markCompleteResponse = await agent.put(`/todos/${FirstTodoId}`).send({
      _csrf: csrfToken,
      completed: true,
    });
    expect(markCompleteResponse.statusCode).toBe(422);
    //Try marking incomplete
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    const markInCompleteResponse = await agent
      .put(`/todos/${FirstTodoId}`)
      .send({
        _csrf: csrfToken,
        completed: false,
      });
    expect(markInCompleteResponse.statusCode).toBe(422);
  });

  test("One user shouldn't be able delete other's todos", async () => {
    const agent = request.agent(server);
    let res = await agent.get("/signup");
    let csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "test",
      lastName: "testtest",
      email: "t@t.c",
      password: "passwordIsStoredHere",
      _csrf: csrfToken,
    });
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/todos").send({
      title: "WD201",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const FirstTodoId = res.id;
    await agent.get("/signout");
    res = await agent.get("/signup");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "DummyData",
      lastName: "DummyData",
      email: "DummyData@gmail.com",
      password: "DummyData123456789",
      _csrf: csrfToken,
    });
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/todos").send({
      title: "Talk with bucky",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const SecondTodoId = res.id;
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    let delTodoRes = await agent.delete(`/todos/${FirstTodoId}`).send({
      _csrf: csrfToken,
    });
    expect(delTodoRes.statusCode).toBe(422);

    await login(agent, "t@t.c", "passwordIsStoredHere");
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    delTodoRes = await agent.delete(`/todos/${SecondTodoId}`).send({
      _csrf: csrfToken,
    });
    expect(delTodoRes.statusCode).toBe(422);
  }, 30000);
});
