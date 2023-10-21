"use strict"; // Строгий режим

//~~ Подключение Модулей ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const database = require("./werk/database_connect"); // Подключение базы данных
const data_4_render = require("./werk/data4render"); // Дата для res.render()
const controller = require("./werk/auth_controller"); // Регистрация

//~~ Библиотеки/Фреймворки ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const { XMLBuilder } = require("fast-xml-parser");

//~~ EXPRESS. Настройка и Запуск сервера ~~~~~~~~~~~~~~~~~~
const port = process.env.PORT || 5500;
const app = express();

app.use(express.static(path.join(__dirname + "/public")));
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Шаблоны для рендеринга 'ejs'
app.set("view engine", "ejs");

//~~~ JWT ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware для проверки авторизации у пользователей
const jwtAuthCheck = async (req, res, next) => {
  try {
    const jwtCookie = req.cookies.token;
    if (!jwtCookie) {
      data_4_render.message = `Время сеанса истекло!`;
      data_4_render.correct = true;
      return res.redirect("/welcome");
    }

    jwt.verify(jwtCookie, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        data_4_render.message = `Время сеанса истекло!`;
        data_4_render.correct = true;
        return res.redirect("/welcome"); // Если токен недействителен
      }

      req.user = user;
      next();
    });
  } catch (error) {
    return next(error);
  }
};

// Middleware для проверки наличия jwt-токена
function checkToken(req, res, next) {
  const token = req.cookies.token;
  if (token) return res.redirect("/home");
  next();
}

app.post("/registration", controller.registration);
app.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    database.query(
      `SELECT * FROM users WHERE email='${email}'`,
      async (err, result) => {
        if (err) throw err;

        // Если пользователя в БД нет
        if (result.rows.length == 0) {
          data_4_render.message = `Ошибка Авторизации: Пользователя с почтой '${email}' нет в системе!`;
          data_4_render.correct = false;
          data_4_render.passwordAuth =
            data_4_render.emailAuth =
            data_4_render.emailReg =
            data_4_render.passwordReg =
              "";
          res.redirect("/welcome");
        } else {
          const hashedPassword = result.rows[0].password;
          const isMatch = await bcrypt.compare(password, hashedPassword);
          if (!isMatch) {
            data_4_render.message = `Ошибка Авторизации: Неправильный пароль!`;
            data_4_render.emailAuth = email;
            data_4_render.correct = false;
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
              { email: email },
              process.env.ACCESS_TOKEN_SECRET,
              { expiresIn: `30m` } // В секундах
            );

            res.cookie("token", accessToken, {
              secure: true,
              httpOnly: true,
              maxAge: 1000 * 60 * 30 - 10, // В милисекундах
            });
            res.redirect("/home");
          }
        }
      }
    );
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "Login Error!" });
  }
});

//~~ EXPRESS. Обработка запросов ~~~~~~~~~~~~~~~~~~~~~~~~~~
app.get("/", (req, res) => {
  data_4_render.emailAuth =
    data_4_render.passwordAuth =
    data_4_render.emailReg =
    data_4_render.passwordReg =
      "";
  data_4_render.correct = true;
  res.redirect("/welcome");
});

app.get("/welcome", checkToken, (req, res) => {
  res.render(__dirname + "/views/pages/auth.ejs", {
    data_4_render,
  });
});

app.get("/home", jwtAuthCheck, (req, res) => {
  res.render(__dirname + "/views/pages/index.ejs", {
    data_4_render,
  });
});

app.post("/parse", jwtAuthCheck, (req, res) => {
  const shop = req.body.shop;
  const authUserEmail = req.user.email;

  let categories = [];
  let category = "";
  let it = 0;
  let all = [];
  let count = 0;

  if (shop == "Ozon") {
    category = req.body.ozon_category;
    it = 23;
    categories = [
      "Автотовары",
      "Антиквариат и коллекционирование",
      "Аптека",
      "Бытовая техника",
      "Бытовая химия",
      "Все для игр",
      "Детские товары",
      "Дом и сад",
      "Канцелярские товары",
      "Книги",
      "Красота и здоровье",
      "Мебель",
      "Музыка и видео",
      "Одежда, обувь и аксессуары",
      "Продукты питания",
      "Спортивные товары",
      "Строительство и ремонт",
      "Товары для животных",
      "Туризм, рыбалка, охота",
      "Хобби и творчество",
      "Цифровые товары",
      "Электроника",
      "Ювелирные украшения",
    ];
  } else if (shop == "Leroy Merlin") {
    category = req.body.leroy_category;
    it = 16;
    categories = [
      "Водоснабжение",
      "Декор",
      "Инструменты",
      "Краски",
      "Кухни",
      "Напольные покрытия",
      "Окна и двери",
      "Освещение",
      "Плитка",
      "Сад",
      "Сантехника",
      "Столярные изделия",
      "Стройматериалы",
      "Хранение",
      "Электротовары",
    ];
  }

  //! Сохранение выбранного интернет-магазина и категории товаров в БД
  const userQ = `UPDATE users SET selected_shop='${shop}', selected_category='${category}' WHERE email='${authUserEmail}';`;
  database.query(userQ, (error) => {
    if (error) throw error;
  });

  //! Сбор данных для графиков и не только
  let quer = `SELECT DISTINCT product_category FROM products WHERE shop='${shop}' ORDER BY product_category ASC;`;
  database.query(quer, (error, results) => {
    if (error) throw error;

    let num = results.rows.length;
    console.log(`\tКол-во категорий товаров у '${shop}': `, num);
    for (let elem in results.rows) {
      let pd = [];
      let que = `SELECT product_category, products.parse_date, AVG(products.product_cost), MAX(products.product_cost), MIN(products.product_cost) FROM products JOIN products_log ON products.product_id = products_log.product_id WHERE product_category='${results.rows[elem].product_category}' GROUP BY product_category, products.parse_date ORDER BY parse_date ASC, product_category ASC;`;
      database.query(que, (error, result) => {
        if (error) throw error;

        for (let elem in result.rows) {
          let dbDate = new Date(result.rows[elem].parse_date.toString());
          let w = dbDate.getTimezoneOffset() * 60000;
          let dbDate_correct = new Date(dbDate.getTime() - w)
            .toISOString()
            .split("T")[0];

          result.rows[elem].parse_date = dbDate_correct;
          result.rows[elem].avg = (+result.rows[elem].avg).toFixed();
        }

        for (let elem in result.rows) {
          pd.push(result.rows[elem].parse_date);
        }

        const min = result.rows[0].min;
        const max = result.rows[0].max;

        const Arr = [];
        let ind = 0;
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateString = date.toISOString().slice(0, 10);
          if (pd.includes(dateString)) {
            let dat = result.rows;
            const obj = dat.find((item) => item.parse_date === pd[ind]);
            const avg = obj ? obj.avg : null;
            Arr.push(+avg);
            ind++;
          } else {
            Arr.push(null);
          }
        }
        help([results.rows[elem].product_category, Arr, min, max], num);
      });
    }
  });

  function help(bobs, totalID) {
    count++;
    all.push(bobs);
    if (count == totalID) {
      all.sort((a, b) => a[0].localeCompare(b[0]));
      // console.log(all);

      const jsonStr = JSON.stringify(all);

      let minArr = [];
      let maxArr = [];
      for (let w in all) {
        minArr.push(all[w][2]);
        maxArr.push(all[w][3]);
      }

      let dat1 = all[0][1];
      let dat2 = all[1][1];
      let dat3 = all[2][1];
      let dat4 = all[3][1];
      let dat5 = all[4][1];
      let dat6 = all[5][1];
      let dat7 = all[6][1];
      let dat8 = all[7][1];
      let dat9 = all[8][1];
      let dat10 = all[9][1];
      let dat11 = all[10][1];
      let dat12 = all[11][1];
      let dat13 = all[12][1];
      let dat14 = all[13][1];
      let dat15 = all[14][1];
      let dat16 = all[15][1];
      let dat17 = all[16][1];
      let dat18 = all[17][1];
      let dat19 = all[18][1];
      let dat20 = all[19][1];
      let dat21 = all[20][1];
      let dat22 = all[21][1];
      let dat23 = all[22][1];

      res.render(__dirname + "/views/pages/parse.ejs", {
        data_4_render,
        shop,
        category,
        it,
        categories,
        minArr,
        maxArr,
        arr: JSON.stringify(dat1),
        arr2: JSON.stringify(dat2),
        arr3: JSON.stringify(dat3),
        arr4: JSON.stringify(dat4),
        arr5: JSON.stringify(dat5),
        arr6: JSON.stringify(dat6),
        arr7: JSON.stringify(dat7),
        arr8: JSON.stringify(dat8),
        arr9: JSON.stringify(dat9),
        arr10: JSON.stringify(dat10),
        arr11: JSON.stringify(dat11),
        arr12: JSON.stringify(dat12),
        arr13: JSON.stringify(dat13),
        arr14: JSON.stringify(dat14),
        arr15: JSON.stringify(dat15),
        arr16: JSON.stringify(dat16),
        arr17: JSON.stringify(dat17),
        arr18: JSON.stringify(dat18),
        arr19: JSON.stringify(dat19),
        arr20: JSON.stringify(dat20),
        arr21: JSON.stringify(dat21),
        arr22: JSON.stringify(dat22),
        arr23: JSON.stringify(dat23),
      });
    }
  }

});

app.get("/about", jwtAuthCheck, (req, res) => {
  res.render(__dirname + "/views/pages/about.ejs", {
    data_4_render,
  });
});

app.get("/werk/grafic.js", jwtAuthCheck, (req, res) => {
  res.sendFile(__dirname + "/werk/grafic.js");
});

app.get("/extra.js", jwtAuthCheck, (req, res) => {
  res.sendFile(__dirname + "/extra.js");
});

app.post("/download", jwtAuthCheck, (req, res) => {
  const format = req.body.format;

  let selectedShop = "";
  let selectedCategory = "";

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  const userEmail = req.user.email;
  const userQ = `SELECT selected_shop, selected_category FROM users WHERE email='${userEmail}'`;
  database.query(userQ, (err, results) => {
    if (err) throw err;
    getShopAndCategory(
      results.rows[0].selected_shop,
      results.rows[0].selected_category
    );
  });
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Функция для создания и скачивания файла
  function downloadFile(data, filename, mimetype) {
    console.log(`\t...\n\tINFO: Начало скачивания файла...`);
    // Создание файла на сервере
    fs.writeFile(filename, data, "utf8", function (err) {
      if (err) {
        console.log(`\tERROR: Ошибка при создании файла для скачивания!`, err);
      } else {
        console.log(`\tSUCCESS: Файл для скачивания был УСПЕШНО создан!`);

        res.set("Content-Type", mimetype); // Установка типа MIME
        // Отправка файла на клиентскую часть
        res.download(filename, function (err) {
          if (err) {
            console.log(
              `\tERROR: Ошибка при отправке файла на клиентскую часть!`,
              err
            );
          } else {
            console.log(
              `\tSUCCESS: Файл был УСПЕШНО отправлен на клиентскую часть!`
            );
            // Удаление файла с сервера
            fs.unlink(filename, function (err) {
              if (err) {
                console.log(
                  `\tERROR: Ошибка при удалении файла с сервера!`,
                  err
                );
              } else {
                console.log(`\tSUCCESS: Файл был УСПЕШНО удалён с сервера!`);
              }
            });
          }
        });
      }
    });
  }
  //~~~~~~~~~~~~

  function getShopAndCategory(shop, cat) {
    selectedShop = shop;
    selectedCategory = cat;

    let productsQuery = "";
    if (selectedCategory == "all") {
      productsQuery = `SELECT p.product_name, p.shop, p.product_category, l.product_cost, l.parse_date 
    FROM products p JOIN products_log l ON p.product_id = l.product_id 
    WHERE p.shop = '${selectedShop}'
    ORDER BY p.product_name;`;
    } else
      productsQuery = `SELECT p.product_name, p.shop, p.product_category, l.product_cost, l.parse_date 
  FROM products p JOIN products_log l ON p.product_id = l.product_id 
  WHERE p.shop = '${selectedShop}' AND p.product_category = '${selectedCategory}'
  ORDER BY p.product_name;`;

    if (format == "CSV") {
      let csv =
        "Product_Name\tShop\tProduct_Category\tProduct_Cost\tParse_date\n";

      database.query(productsQuery, async (err, results) => {
        if (err) throw err;

        for (let elem in results.rows) {
          let dbDate = new Date(results.rows[elem].parse_date.toString());
          let w = dbDate.getTimezoneOffset() * 60000;
          let dbDate_correct = new Date(dbDate.getTime() - w)
            .toISOString()
            .split("T")[0];

          results.rows[elem].parse_date = dbDate_correct;
        }

        results.rows.forEach((row) => {
          for (let el in row) {
            csv += `${row[el]}\t`;
          }
          csv.slice(0, -1);
          csv += "\n";
        });

        downloadFile(csv, "Parsed Data.csv", "text/csv");
      });
    } else if (format == "XML") {
      database.query(productsQuery, async (err, results) => {
        if (err) throw err;

        for (let elem in results.rows) {
          let dbDate = new Date(results.rows[elem].parse_date.toString());
          let w = dbDate.getTimezoneOffset() * 60000;
          let dbDate_correct = new Date(dbDate.getTime() - w)
            .toISOString()
            .split("T")[0];

          results.rows[elem].parse_date = dbDate_correct;
        }

        let products = results.rows;
        const builder = new XMLBuilder({
          arrayNodeName: "product",
          processEntities: false,
          format: true,
          ignoreAttributes: false,
        });
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
    <data>
      ${builder.build(products)}
    </data>`;

        downloadFile(xmlContent, "Parsed Data.xml", "application/xml");
      });
    } else if (format == "PDF") {
      database.query(productsQuery, async (err, results) => {
        if (err) throw err;

        for (let elem in results.rows) {
          let dbDate = new Date(results.rows[elem].parse_date.toString());
          let w = dbDate.getTimezoneOffset() * 60000;
          let dbDate_correct = new Date(dbDate.getTime() - w)
            .toISOString()
            .split("T")[0];

          results.rows[elem].parse_date = dbDate_correct;
        }

        let prod = results.rows;
        let len = prod.length;

        res.render(__dirname + "/views/pages/pdf.ejs", {
          data_4_render,
          prod,
          len,
        });
      });
    }
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/welcome");
});

app.listen(port, () => {
  console.log(`\tINFO: Сервер был запущен на "http://localhost:${port}"!`);
});

//~~ Docker-образы ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// docker-compose up -d
// docker-compose down