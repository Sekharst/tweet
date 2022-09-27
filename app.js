const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const convertTweetDbObjectToResponseObject = (dbObject) => {
  return {
    username: dbObject.name,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  };
};

const validatePassword = (password) => {
  return password.length > 4;
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

//API 1

app.post("/register/", async (request, response) => {
  const { username, password, gender, name } = request.body;
  const hashedPassword = bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
          INSERT INTO
            user (username, password, name, gender) 
          VALUES 
            (
            '${username}', 
            '${hashedPassword}', 
            '${name}',
            '${gender}'
            );`;
    if (validatePassword(password)) {
      await database.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// API 2

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);

  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getTweetsQuery = `
    SELECT * FROM User NATURAL JOIN Tweet LIMIT 4;`;
  const tweetsArray = await db.all(getTweetsQuery);
  response.send(
    tweetsArray.map((eachTweet) =>
      convertTweetDbObjectToResponseObject(eachTweet)
    )
  );
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const getFollowingQuery = `SELECT name FROM Follower INNER JOIN User ON User.user_id = Follower.follower_user_id;`;
  const followingArray = await db.all(getFollowingQuery);
  response.send(followingArray);
});

//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getFollowersQuery = `SELECT name FROM Follower INNER JOIN User ON User.user_id = Follower.following_user_id;`;
  const followersArray = await db.all(getFollowersQuery);
  response.send(followersArray);
});

//API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const getTweetQuery = `
    SELECT 
      tweet,count(like_id) As likes ,count(reply_id) As replies,date_time As dateTime
    FROM
      tweet NATURAL JOIN (SELECT * FROM like NATURAL JOIN reply WHERE tweet_id = ${tweetId} GROUP BY tweet_id) WHERE tweet_id= ${tweetId} GROUP BY tweet_id;`;
  const tweet = await db.all(getTweetQuery);
  response.send(tweet);
});

//API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getLikedTweetQuery = `SELECT username FROM like NATURAL JOIN user WHERE tweet_id=${tweetId};`;
    const likes = await db.all(getLikedTweetQuery);
    console.log(likes);
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const getTweetRepliesQuery = `SELECT name,reply FROM reply NATURAL JOIN user WHERE tweet_id= ${tweetId};`;
    const replies = await db.all(getTweetRepliesQuery);
    response.send(replies);
  }
);

//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { user } = request.params;
  const getAllTweetsQuery = `SELECT 
      tweet,count(like_id) As likes ,count(reply_id) As replies,date_time As dateTime
    FROM
      tweet NATURAL JOIN (SELECT * FROM like NATURAL JOIN reply GROUP BY tweet_id) WHERE username = ${user} GROUP BY user;`;
  const allTweets = await db.all(getAllTweetsQuery);
  console.log(getAllTweetsQuery);
});

//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet_id, user_id, date_time, tweet } = request.body;
  const postTweetQuery = `
  INSERT INTO
    Tweet (tweet)
  VALUES
    ('${tweet}');`;
  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

//API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteTweetQuery = `
  DELETE FROM
    Tweet
  WHERE
    tweet_id = ${tweetId}
  `;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
);

module.exports = app;
