const database = require("./database_connect");
const bcrypt = require("bcrypt");
const data_4_render = require("./data4render");
const jwt = require("jsonwebtoken");

class authController {
  async registration(req, res) {
    try {
      const email = req.body.email_new;
      const password = req.body.password_new;
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);
      database.query(
        `SELECT * FROM users WHERE email='${email}'`,
        async (err, result) => {
          if (err) throw err;

          // Если пользователя в бд нет
          if (result.rows.length == 0) {
            database.query(
              `INSERT INTO users(email, password)
               VALUES ('${email}', '${hashedPassword}');`,
              async (err) => {
                if (err) throw err;

                res.redirect("/welcome");
              }
            );
            data_4_render.message = `Регистрация прошла успешно! Теперь войдите в систему!`;
            data_4_render.correct = true;
            data_4_render.emailReg =
              data_4_render.passwordReg =
              data_4_render.emailAuth =
              data_4_render.passwordAuth =
                "";
          } else {
            data_4_render.message = `Ошибка Регистрации: Пользователь с такой почтой уже есть в системе!`;
            data_4_render.correct = false;
            data_4_render.emailReg = email;
            data_4_render.passwordReg = password;
            data_4_render.emailAuth = data_4_render.passwordAuth = "";
            res.redirect("/welcome");
          }
        }
      );
    } catch (error) {
      console.log(error);
      res.status(400).json({ message: "ОШИБКА РЕГИСТРАЦИИ! :(" });
    }
  }
  async login(req, res) {
    try {
      const { email, password } = req.body;
      database.query(
        `SELECT * FROM users WHERE email='${email}'`,
        async (err, result) => {
          if (err) throw err;

          // Если пользователя в БД нет
          if (result.rows.length == 0) {
            data_4_render.message = `Ошибка Авторизации: Такого пользователя нет в системе!`;
            data_4_render.correct = false;
            data_4_render.emailAuth = email;
            data_4_render.passwordAuth = password;
            res.redirect("/welcome");
          } else {
            const hashedPassword = result.rows[0].password;
            const isMatch = await bcrypt.compare(password, hashedPassword);
            database.query(
              `SELECT password FROM users WHERE email='${email}'`,
              (err, result) => {
                if (err) throw err;

                // console.log(result.rows[0].password); // !!!
                if (!isMatch) {
                  data_4_render.message = `Ошибка Авторизации: Такого пользователя нет в системОшибка Авторизации: Неправильный пароль!`;
                  data_4_render.correct = false;
                  data_4_render.emailAuth = email;
                  data_4_render.passwordAuth =
                    data_4_render.emailReg =
                    data_4_render.passwordReg =
                      "";
                  res.redirect("/welcome");
                } else {
                  data_4_render.message =
                    data_4_render.emailAuth =
                    data_4_render.passwordAuth =
                    data_4_render.emailReg =
                    data_4_render.passwordReg =
                      "";
                  data_4_render.correct = true;

                  const accessToken = jwt.sign(
                    { email: email, password: hashedPassword },
                    accessTokenSecret,
                    { expiresIn: "20m" }
                  );
                  const refreshToken = jwt.sign(
                    { email: email, password: hashedPassword },
                    refreshTokenSecret
                  );

                  refreshTokens.push(refreshToken);
                  res.json({
                    accessToken,
                    refreshToken,
                  });
                  // .redirect("/home");
                }
              }
            );
          }
        }
      );
    } catch (error) {
      console.log(error);
      res.status(400).json({ message: "Login Error!" });
    }
  }
  async getUsers(req, res) {
    try {
    } catch (error) {
      console.log(error);
    }
  }

  checkUser(email, password) {
    database.query(
      `SELECT * FROM users WHERE email=${email}`,
      (err, result) => {
        if (err) {
          throw err;
        }
        console.log(result);
      }
    );
  }
}

module.exports = new authController();
