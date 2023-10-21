"use strict"; // Строгий режим

//~~ Подключение Модулей ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const database = require("./database_connect");

//~~ Библиотеки/Фреймворки ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const UserAgent = require("user-agents");
const userAgent = new UserAgent({
  deviceCategory: "desktop",
  platform: "Win32",
});

//!~~ ГЛАВНЫЕ ФУНКЦИИ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * Считает, сколько дней ведётся запись данных для каждого интернет-магазина для каждой из категории товаров
 * @param {*} shop Название интернет-магазина
 */
async function countDaysforCategories(shop) {
  const quer = `SELECT DISTINCT product_category FROM products WHERE shop='${shop}' ORDER BY product_category ASC;`;
  database.query(quer, (error, results) => {
    if (error) throw error;

    for (let elem in results.rows) {
      const pd = [];
      pd.push(results.rows[elem].product_category);
      const que = `SELECT product_category, products.parse_date, AVG(products.product_cost), MAX(products.product_cost), MIN(products.product_cost) FROM products JOIN products_log ON products.product_id = products_log.product_id WHERE product_category='${results.rows[elem].product_category}' GROUP BY product_category, products.parse_date ORDER BY parse_date ASC, product_category ASC;`;
      database.query(que, async (error, result) => {
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

        console.log(results.rows[elem].product_category, result.rows.length);
      });
    }
  });
}

/**
 * Собирает данные о товарах с интернет-магазинов.
 * @param {string} shop Интернет-магазин, с которого будут собраны данные
 */
async function parseProducts(shop) {
  // Запускаем puppeteer
  await puppeteer
    .launch({
      headless: false, // false: позволяет нам наблюдать за тем, что происходит
      defaultViewport: null,
      executablePath:
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      userDataDir:
        "%userprofile%\\AppData\\Local\\Google\\Chrome\\User Data\\AllowCookies",
      args: [
        "--disable-web-security",
        "--fast-start",
        "--disable-extensions",
        "--no-sandbox",
      ],
      ignoreHTTPSErrors: true,
    })
    .then(async (browser) => {
      const page = await browser.newPage();
      const data = fs.readFileSync("./categories.json");
      const categories = JSON.parse(data);

      if (shop == "Ozon") {
        // Бегаем по категориям
        for (let i in categories.Ozon) {
          const category = categories.Ozon[i][0].category;
          const categoryURL = categories.Ozon[i][0].url;

          // Вид поля с товарами
          let pageStyle = "";
          if (
            categoryURL ==
              "https://www.ozon.ru/category/bytovaya-tehnika-10500/" ||
            categoryURL == "https://www.ozon.ru/category/elektronika-15500/"
          ) {
            pageStyle = "Horrizontal";
          } else if (
            categoryURL ==
            "https://www.ozon.ru/category/odezhda-obuv-i-aksessuary-7500/"
          ) {
            pageStyle = "Huge";
          } else if (
            categoryURL == "https://www.ozon.ru/category/dom-i-sad-14500/" ||
            categoryURL ==
              "https://www.ozon.ru/category/yuvelirnye-ukrasheniya-50001/"
          ) {
            pageStyle = "Medium";
          } else pageStyle = "Small";

          console.log(
            `\t...\n\tINFO: Сбор данных о товарах с категорией "${category}" (${shop})...`
          );

          await page.goto(`${categoryURL}`, { waitUntil: "networkidle2" });

          // Собираем данные со всех страниц категории
          let hasNextPage = true;
          let pageNumber = 1;
          const productsList = [];

          // Бегаем по страницам категории
          while (hasNextPage) {
            // Если ничего на странице нету
            try {
              await page.waitForSelector("#paginatorContent > div > div", {
                timeout: 2000,
              });
            } catch (error) {
              break;
            }

            let countProducts = 0;
            try {
              console.log(
                `\tINFO: Сбор со страницы #${pageNumber} (${shop})...`
              );

              for (let j = 1; j <= 35; j++) {
                let products = "";
                const productField = giveSelector(
                    j,
                    "product field",
                    pageStyle,
                    "Ozon"
                  ),
                  productNameField = giveSelector(
                    j,
                    "name field",
                    pageStyle,
                    "Ozon"
                  ),
                  productURLField = giveSelector(
                    j,
                    "url field",
                    pageStyle,
                    "Ozon"
                  ),
                  productImgField = giveSelector(
                    j,
                    "image field",
                    pageStyle,
                    "Ozon"
                  );
                let productPriceField = giveSelector(
                  j,
                  "price field",
                  pageStyle,
                  "Ozon"
                );

                //! Не устарели ли селекторы?
                try {
                  await page.waitForSelector(productField);
                } catch (error) {
                  try {
                    await page.waitForSelector(`#paginatorContent > div > div`);
                    hasNextPage = false;
                    break;
                  } catch (error) {
                    await browser.close();
                    console.log(
                      `\tERROR: Селектр у поля с именем товара был обновлён (${shop}) [Категория: ${category}]!`
                    );
                    throw error;
                  }
                }
                try {
                  await page.waitForSelector(productURLField);
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Селектр у поля с URL товара был обновлён (${shop}) [Категория: ${category}]!`
                  );
                  throw error;
                }
                try {
                  await page.waitForSelector(productNameField);
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Селектр у поля с названием товара был обновлён (${shop}) [Категория: ${category}]!`
                  );
                  throw error;
                }
                try {
                  await page.waitForSelector(productPriceField);
                } catch (error) {
                  try {
                    // Цены без выделения цветом
                    if (pageStyle == "Horrizontal")
                      productPriceField = `#paginatorContent > div > div > div:nth-child(${j}) > div.i2o > div.d7-a.ki9 > span > span.d7-a2`;
                    if (pageStyle == "Huge")
                      productPriceField = `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0.o0i > div.d7-a.ki9 > span > span.d7-a2`;
                    if (pageStyle == "Medium")
                      productPriceField = `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > div.d7-a.ki9 > span > span.d7-a2`;
                    if (pageStyle == "Small")
                      productPriceField = `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > div.d7-a.ki9 > span > span.d7-a2`;

                    await page.waitForSelector(productNameField);
                  } catch (error) {
                    try {
                      await page.waitForSelector(
                        `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > div.d7-a.ki9 > span > span`
                      );
                    } catch (error) {
                      await browser.close();
                      console.log(
                        `\tERROR: Селектр у поля с ценой товара был обновлён (${shop}) [Категория: ${category}]!`
                      );
                      throw error;
                    }
                  }
                }
                try {
                  await page.waitForSelector(productImgField);
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Селектр у поля с изображением товара был обновлён (${shop}) [Категория: ${category}]!`
                  );
                  throw error;
                }

                //! Извлечение данных
                try {
                  products = await page.$$eval(productField, (elements) => {
                    return elements.map((element) => {
                      const name = element.querySelector(
                        ".v0d.d1v.v1d.v3d.tsBodyL.ki9.li span"
                      );

                      let url = element.querySelector(".o2i a");
                      let cost = element.querySelector(".d6-a0");
                      let img = element.querySelector(".l3i img");
                      if (img == null) img = ``;
                      if (cost == null)
                        cost = element.querySelector(`.oi0.d7-a.ki9 span`);
                      if (cost == null)
                        cost = element.querySelector(`.k6x span`);
                      if (url == null) url = element.querySelector(".oi0 a");
                      return {
                        name: name ? name.textContent.trim() : "",
                        url: url ? url.href.trim() : "",
                        img: img ? img.src.trim() : "",
                        cost: cost
                          ? cost.textContent.replace(
                              /[\t\n\v\f\r \u00a0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000₽]/g,
                              ""
                            )
                          : "",
                      };
                    });
                  });
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Поле(-я) товаров были обновлёны (${shop})!`
                  );
                  throw error;
                }

                //! Проверка собранных данных
                if (
                  products[0].name === "" ||
                  products[0].url === "" ||
                  products[0].img === "" ||
                  products[0].cost === ""
                ) {
                  console.log(
                    `\tERROR: Некоторые собранные данные - пустые строки (${shop})!`
                  );
                  continue;
                  // throw error;
                } else {
                  productsList.push(products);
                  countProducts++;

                  databaseInsert(productsList, category, categoryURL, shop);
                }
              }
            } catch (error) {
              throw error;
            }

            console.log(
              `\tSUCCESS: На странице #${pageNumber} были собраны данные ${countProducts} товаров! (${shop})`
            );

            console.log(`\tINFO: Заполнение БД... (${shop})`);

            // Переходим на следующую страницу категории, если она есть
            try {
              if (pageNumber < 3) {
                pageNumber++;
                await page.goto(`${categoryURL}` + `?page=${pageNumber}`, {
                  waitUntil: "domcontentloaded",
                });
              } else {
                pageNumber = 1;
                break;
              }
            } catch (error) {
              hasNextPage = false;
              throw error;
            }
          }
        }
      }

      if (shop == "Leroy") {
        // Бегаем по категориям
        for (let i in categories.Leroy) {
          const category = categories.Leroy[i][0].category;
          const categoryURL = categories.Leroy[i][0].url;

          // Вид поля с товарами
          let pageStyle = "";

          console.log(
            `\t...\n\tINFO: Сбор данных о товарах с категорией "${category}" (${shop})...`
          );

          await page.goto(`${categoryURL}`, { waitUntil: "networkidle2" });

          // Собираем данные со всех страниц категории
          let hasNextPage = true;
          let pageNumber = 1;
          const productsList = [];

          // Бегаем по страницам категории
          while (hasNextPage) {
            // Если ничего на странице нету
            try {
              await page.waitForSelector(
                "#root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section",
                {
                  timeout: 2000,
                }
              );
            } catch (error) {
              break;
            }

            let countProducts = 0;
            try {
              console.log(
                `\tINFO: Сбор со страницы #${pageNumber} (${shop})...`
              );

              for (let j = 1; j <= 30; j++) {
                let products = "";

                // pr field
                // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j})
                // img
                // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > a > span > picture > source:nth-child(1)
                // URL
                // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.c155f0re_plp.c1j76yjw_plp.largeCard > a
                // name
                // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.c155f0re_plp.c1j76yjw_plp.largeCard > a > span > span

                // price (normal)
                // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.oo1t094_plp.largeCard > div.p1h8lbu4_plp > div > span.mvc4syb_plp
                // price (best price!)
                // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.oo1t094_plp.largeCard > div.p1h8lbu4_plp > div > div.sz5q419_plp > div > span.mvc4syb_plp.sncjxni_plp.bf9hkrt_plp
                // price (целая часть)
                // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.oo1t094_plp.largeCard > div.p1h8lbu4_plp > div > span.mvc4syb_plp
                // price (дробная часть часть)
                // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.oo1t094_plp.largeCard > div.p1h8lbu4_plp > div > span:nth-child(2)
                let productField = giveSelector(
                    j,
                    "product field",
                    pageStyle,
                    "Leroy"
                  ),
                  productNameField = giveSelector(
                    j,
                    "name field",
                    pageStyle,
                    "Leroy"
                  ),
                  productURLField = giveSelector(
                    j,
                    "url field",
                    pageStyle,
                    "Leroy"
                  ),
                  productPriceField = giveSelector(
                    j,
                    "price field",
                    pageStyle,
                    "Leroy"
                  ),
                  productImgField = giveSelector(
                    j,
                    "image field",
                    pageStyle,
                    "Leroy"
                  );

                //! Не устарели ли селекторы?
                try {
                  await page.waitForSelector(productField);
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Селектр у поля с именем товара был обновлён (${shop}) [Категория: ${category}]!`
                  );
                  throw error;
                }
                try {
                  await page.waitForSelector(productURLField);
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Селектр у поля с URL товара был обновлён (${shop}) [Категория: ${category}]!`
                  );
                  throw error;
                }
                try {
                  await page.waitForSelector(productNameField);
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Селектр у поля с названием товара был обновлён (${shop}) [Категория: ${category}]!`
                  );
                  throw error;
                }
                try {
                  await page.waitForSelector(productPriceField);
                } catch (error) {
                  try {
                    // price (best price!)
                    // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.oo1t094_plp.largeCard > div.p1h8lbu4_plp > div > div.sz5q419_plp > div > span.mvc4syb_plp.sncjxni_plp.bf9hkrt_plp
                    await page.waitForSelector(
                      `#paginatorContent > div > div > div:nth-child(${j}) > div.i2o > div.d7-a.ki9 > span > span.d7-a2`
                    );
                  } catch (error) {
                    await browser.close();
                    console.log(
                      `\tERROR: Селектр у поля с ценой товара был обновлён (${shop}) [Категория: ${category}]!`
                    );
                    throw error;
                  }
                }
                try {
                  await page.waitForSelector(productImgField);
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Селектр у поля с изображением товара был обновлён (${shop}) [Категория: ${category}]!`
                  );
                  throw error;
                }

                //! Извлечение данных
                try {
                  products = await page.$$eval(productField, (elements) => {
                    return elements.map((element) => {
                      const name = element.querySelector(
                        ".t9jup0e_plp.p16wqyak_plp span"
                      );

                      let url = element.querySelector(
                        ".c155f0re_plp.c1j76yjw_plp.largeCard a"
                      );
                      let cost = element.querySelector(".mvc4syb_plp");
                      let img = element.querySelector(
                        ".p10zxbd6_plp source:nth-child(1"
                      );
                      if (img == null) img = ``;
                      if (cost == null)
                        cost = element.querySelector(`.d7-a2 span`);
                      return {
                        name: name ? name.textContent.trim() : "",
                        url: url ? url.href.trim() : "",
                        img: img ? img.srcset.trim() : "",
                        cost: cost
                          ? cost.textContent.replace(
                              /[\t\n\v\f\r \u00a0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000₽]/g,
                              ""
                            )
                          : "",
                      };
                    });
                  });

                  // console.log(
                  //   "name:",
                  //   products[0].name,
                  //   "\n",
                  //   "url:",
                  //   products[0].url,
                  //   "\n",
                  //   "img:",
                  //   products[0].img,
                  //   "\n",
                  //   "cost:",
                  //   products[0].cost,
                  //   "\n"
                  // );
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Поле(-я) товаров были обновлёны (${shop})!`
                  );
                  throw error;
                }

                //! Проверка собранных данных
                if (
                  products[0].name === "" ||
                  products[0].url === "" ||
                  products[0].img === "" ||
                  products[0].cost === ""
                ) {
                  // await browser.close();
                  // console.log(
                  //   products[0].name,
                  //   "\n",
                  //   products[0].url,
                  //   "\n",
                  //   products[0].img,
                  //   "\n",
                  //   products[0].cost,
                  //   "\n"
                  // );
                  console.log(
                    `\tERROR: Некоторые собранные данные - пустые строки (${shop})!`
                  );
                  continue;
                  // throw error;
                } else {
                  productsList.push(products);
                  countProducts++;

                  databaseInsert(productsList, category, categoryURL, shop);
                }
              }
            } catch (error) {
              throw error;
            }

            console.log(
              `\tSUCCESS: На странице #${pageNumber} были собраны данные ${countProducts} товаров! (${shop})`
            );

            console.log(`\tINFO: Заполнение БД... (${shop})`);

            // Переходим на следующую страницу категории, если она есть
            try {
              if (pageNumber < 3) {
                pageNumber++;
                await page.goto(`${categoryURL}` + `?page=${pageNumber}`, {
                  waitUntil: "domcontentloaded",
                });
              } else {
                pageNumber = 1;
                break;
              }
            } catch (error) {
              hasNextPage = false;
              throw error;
            }
          }
        }
      }

      await browser.close();
    });
}

/**
 * Вспомогательная функция, возвращающая селектор в зависимости от поля данных,
 * стиля отображения товаров на странице категории товаров и названия интернет-магазина.
 * @param {number} j Индекс дочернего элемента HTML-элемента ('nth-child(${j})').
 * @param {string} data Поле данных (поле с ценой товара, названием товара, URL товара и т.п.).
 * @param {string} style Параметр, показывающий то, как выглядит страница товаров (значение: "Horrizontal", "Huge", "Medium" и "Small")
 * @param {string} shop Название интернет-магазина ("Shop" или "Leroy")
 * @returns Селектор, из которого необходимо считывать данные
 */
function giveSelector(j, data, style, shop) {
  if (shop == "Ozon") {
    if (data == "product field")
      return `#paginatorContent > div > div > div:nth-child(${j})`;

    if (data == "product check field") {
      if (style == "Horrizontal")
        return `#layoutPage > div.b0 > div.container.b4`;

      if (style == "Huge")
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3)`;

      if (style == "Medium")
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3)`;

      if (style == "Small")
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3)`;
    }

    if (data == "name field") {
      if (style == "Horrizontal")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.io2 > div > a > span > span`;

      if (style == "Huge")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0.o0i > a > span > span`;

      if (style == "Medium")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > a > span > span`;

      if (style == "Small")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > a > span > span`;
    }

    if (data == "url field") {
      if (style == "Horrizontal")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.io2 > div > a`;

      if (style == "Huge")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0.o0i > a`;

      if (style == "Medium")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > a`;

      if (style == "Small") {
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > a`;
      }
    }

    if (data == "price field") {
      if (style == "Horrizontal")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.i2o > div.d6-a.ki9 > div.d6-a0`;

      if (style == "Huge")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0.o0i > div.d6-a.ki9 > div.d6-a0`;

      if (style == "Medium")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > div.d6-a.ki9 > div.d6-a0`;

      if (style == "Small") {
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.oi0 > div.d6-a.ki9 > div.d6-a0`;
      }
    }

    if (data == "image field") {
      if (style == "Horrizontal")
        return `#paginatorContent > div > div > div:nth-child(${j}) > div.o1i > a > div > div.l3i`;

      if (style == "Huge")
        return `#paginatorContent > div > div > div:nth-child(${j}) > a > div > div.l3i`;

      if (style == "Medium")
        return `#paginatorContent > div > div > div:nth-child(${j}) > a > div > div.l3i`;

      if (style == "Small") {
        return `#paginatorContent > div > div > div:nth-child(${j}) > a > div > div.l3i`;
      }
    }

    if (data == "name check field") {
      if (style == "Horrizontal")
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(2) > div > div > div.pk7.k3q.k1q > div:nth-child(2)`;

      if (style == "Huge")
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3) > div:nth-child(3) > div > div:nth-child(5)`;

      if (style == "Medium")
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3) > div:nth-child(3) > div > div:nth-child(6)`;

      if (style == "Small") {
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(2) > div > div > div.pk7.k3q.k1q > div`;
      }
    }

    if (data == "price check field") {
      if (style == "Horrizontal")
        return `#layoutPage > div.b0 > div.container.b4 > div.p8k.qk3 > div.p8k.qk4.qk1.q1k > div.p8k.qk4.qk1.kq2 > div > div > div > div.l4n > div > div > div.k5x.kx7.xk8 > div > span.kx6.k6x > span`;

      if (style == "Huge")
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3) > div:nth-child(3) > div > div.ln4.n2j > div > div > div.l4n > div > div > div.k5x.kx7.xk8 > div > span.kx6.k6x > span`;

      if (style == "Medium")
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3) > div:nth-child(3) > div > div.ln4.n2j > div > div > div.l4n > div > div > div.k5x.kx7.xk8 > div > span.kx6.k6x > span`;

      if (style == "Small") {
        return `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3) > div:nth-child(3) > div > div.ln4.n2j > div > div > div.l4n > div > div > div.k5x.kx7.xk8 > div > span.kx6.k6x > span`;
      }
    }
  }

  if (shop == "Leroy") {
    // pr field
    // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j})
    // img
    // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > a > span > picture > source:nth-child(1)
    // URL
    // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.c155f0re_plp.c1j76yjw_plp.largeCard > a
    // name
    // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.c155f0re_plp.c1j76yjw_plp.largeCard > a > span > span

    // price (normal)
    // #root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.oo1t094_plp.largeCard > div.p1h8lbu4_plp > div > span.mvc4syb_plp

    if (data == "product field") {
      return `#root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j})`;
    }
    if (data == "name field") {
      return `#root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.c155f0re_plp.c1j76yjw_plp.largeCard > a > span > span`;
    }
    if (data == "url field") {
      return `#root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.c155f0re_plp.c1j76yjw_plp.largeCard > a`;
    }
    if (data == "price field") {
      return `#root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > div.oo1t094_plp.largeCard > div.p1h8lbu4_plp > div > span.mvc4syb_plp`;
    }
    if (data == "image field") {
      return `#root > div > main > div.pqgcfsa_plp > div:nth-child(2) > div > section > div:nth-child(5) > section > div.pr7cfcb_plp.largeCard > div:nth-child(${j}) > a > span > picture > source:nth-child(1)`;
    }
  }
}

/**
 *  Добавляет собранные данные в базу данных.
 * @param {object} productsList Собранные данные о товарах
 * @param {string} category Категория товаров
 * @param {string} categoryURL URL категории товаров
 * @param {string} shop Название интернет-магазина
 */
function databaseInsert(productsList, category, categoryURL, shop) {
  for (let k in productsList) {
    const a = `SELECT * FROM products WHERE product_url='${
      productsList[k][0].url.split("?")[0]
    }';`;
    database.query(a, async (err, result) => {
      if (err) {
        console.log(`\taaaI(Ozon)`);
        throw err;
      }
      let dateObj = new Date();
      let parseDate = dateObj.toISOString().split("T")[0];
      if (result.rows.length == 0) {
        let pname = productsList[k][0].name
          .replace(`'`, `''`)
          .replace(`"`, `""`);

        const insert = `INSERT INTO products (product_name, product_cost, product_image, product_url, product_category, product_category_url, shop, parse_date) VALUES ('${pname}', ${+productsList[
          k
        ][0].cost}, '${productsList[k][0].img}', '${
          productsList[k][0].url.split("?")[0]
        }','${category}', '${categoryURL}', '${shop}', '${parseDate}');`;

        database.query(insert, async (error) => {
          if (error) {
            console.log(`\tI(Ozon)`);
            throw error;
          }
        });
      } else {
        let dbDate = new Date(result.rows[0].parse_date.toString());
        let w = dbDate.getTimezoneOffset() * 60000;
        let dbDate_correct = new Date(dbDate.getTime() - w)
          .toISOString()
          .split("T")[0];
        if (dbDate_correct !== parseDate) {
          const insertLog = `INSERT INTO products_log (product_id, product_cost, parse_date, shop) SELECT product_id, ${+productsList[
            k
          ][0].cost}, '${parseDate}', shop FROM products WHERE product_url='${
            productsList[k][0].url.split("?")[0]
          }'`;

          let update = "";
          if (result.rows[0].product_name !== productsList[k][0].name) {
            update = `UPDATE products SET product_cost=${+productsList[k][0]
              .cost}, parse_date='${parseDate}', product_name='${
              productsList[k][0].name
            }' WHERE product_url='${productsList[k][0].url.split("?")[0]}'`;
          } else {
            update = `UPDATE products SET product_cost=${+productsList[k][0]
              .cost}, parse_date='${parseDate}' WHERE product_url='${
              productsList[k][0].url.split("?")[0]
            }'`;
          }

          database.query(insertLog, async (e) => {
            if (e) {
              console.log(`\tIxxx(Ozon)`);
              throw e;
            }
            database.query(update, async (e) => {
              if (e) {
                console.log(`\tIzzz(Ozon)`);
                throw e;
              }
            });
          });
        } else {
          console.log("NO Collect");
        }
      }
    });
  }
}

/** Удаляет устаревшие/некорректные записи о товарах из таблиц базы данных:
 * - Если ссылка товара стала недействительной.
 * - Если в таблице товаров "Products" есть дублирующиеся товары.
 */
async function databaseDeleteInvalidData() {
  const que = `SELECT product_url FROM products ORDER BY parse_date ASC, product_url DESC;`;
  database.query(que, async (err, result) => {
    if (err) throw err;

    for (let i in result.rows) {
      try {
        const urlCheck = new URL(result.rows[i].product_url);
      } catch (error) {
        console.log(
          `\t...\n\tINFO: Были найдены устаревшие данные (${shop}). Удаление...`
        );

        const delQ = `DELETE FROM products WHERE product_url = '${result.rows[i].product_url}';`;
        database.query(delQ, async (error) => {
          if (error) throw error;
          // console.log(results.rows)
        });
      }
    }
  });

  const selQ = `SELECT product_name, COUNT( product_name ) FROM products GROUP BY product_name HAVING COUNT( product_name ) > 1 ORDER BY product_name;`;
  database.query(selQ, (error, results) => {
    if (error) throw error;
    console.log(
      `\tINFO: Кол-во дубликатов в таблице Products: ${results.rows.length}!`
    );

    const alterQ = `ALTER TABLE products DISABLE TRIGGER delete_products_log_trigger;`;
    database.query(alterQ, async (error) => {
      if (error) throw error;
      console.log("\tINFO: Триггер на удаление временно отключён!");

      const deleteQ = `DELETE FROM products a USING products b WHERE a.product_id < b.product_id AND a.product_name = b.product_name;`;
      database.query(deleteQ, async (error) => {
        if (error) throw error;
      });
    });

    const alterQ2 = `ALTER TABLE products ENABLE TRIGGER delete_products_log_trigger;`;
    database.query(alterQ2, async (error) => {
      if (error) throw error;
      console.log("\tINFO: Триггер на удаление включён!");
    });
  });
}

/** Функция проверяет, не обновились ли данные о товарах.
 * Данные о ценах товаров будут собраны даже если товар был распродан. Данные о товарах должны собираться каждый день.
 * Если данные одного товара сегодня уже были собраны, то в базу данных ничего не будет записано.
 * @param {string} shop Название интернет-магазина, данные которого нужно проверить на актуальность и на наличие обновлений: "Ozon" или "Leroy"
 */
async function checkData(shop) {
  // Запускаем puppeteer
  await puppeteer
    .launch({
      headless: false, // false: позволяет нам наблюдать за тем, что происходит
      defaultViewport: null,
      executablePath:
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      userDataDir:
        "%userprofile%\\AppData\\Local\\Google\\Chrome\\User Data\\AllowCookies",
      args: [
        "--disable-web-security",
        "--fast-start",
        "--disable-extensions",
        "--no-sandbox",
        "--user-agent=" + userAgent + "",
      ],
      ignoreHTTPSErrors: true,
    })
    .then(async (browser) => {
      const page = await browser.newPage();

      if (shop == "Ozon") {
        const categories = [
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
        // `SELECT * FROM products WHERE shop='Ozon' AND product_category='Канцелярские товары' ORDER BY parse_date ASC;`
        const que = `SELECT * FROM products WHERE shop='${shop}' AND product_category='${categories[20]}' ORDER BY parse_date ASC, product_cost DESC;`;
        database.query(que, async (err, result) => {
          console.log(
            `\t...\n\tINFO: Обновление собранных данных о товарах (${shop})...`
          );
          for (let i in result.rows) {
            const product = await result.rows[i].product_url;
            const categoryURL = await result.rows[i].product_category_url;
            let pageStyle = "";
            if (
              categoryURL ==
                "https://www.ozon.ru/category/bytovaya-tehnika-10500/" ||
              categoryURL == "https://www.ozon.ru/category/elektronika-15500/"
            ) {
              pageStyle = "Horrizontal";
            } else if (
              categoryURL ==
              "https://www.ozon.ru/category/odezhda-obuv-i-aksessuary-7500/"
            ) {
              pageStyle = "Huge";
            } else if (
              categoryURL == "https://www.ozon.ru/category/dom-i-sad-14500/" ||
              categoryURL ==
                "https://www.ozon.ru/category/yuvelirnye-ukrasheniya-50001/"
            ) {
              pageStyle = "Medium";
            } else pageStyle = "Small";

            await page.goto(`${product}`, { waitUntil: "networkidle2" });

            //! Если товар был распродан/удалён
            const url = await page.evaluate(() => document.location.href);
            if (url.includes("deny_category_prediction")) {
              try {
                await page.waitForSelector(
                  `#layoutPage > div.b0 > div.container.b4 > div:nth-child(1) > div > div.e0 > div.d0.c7 > div.k2v > div > div > div > div.u7k > div:nth-child(2) > div > span`,
                  {
                    timeout: 1000,
                  }
                );
                console.log(
                  "\tNOTE: Товар распродан, но его цена будет собрана."
                );
              } catch (error) {
                console.log("\tNOTE: Товар был удалён! Он будет пропущен.");
                continue;
              }

              const soldoutCost = [];
              try {
                soldoutCost = await page.$$eval(
                  `#layoutPage > div.b0 > div.container.b4 > div:nth-child(1) > div > div.e0`,
                  (elements) => {
                    return elements.map((element) => {
                      // #layoutPage > div.b0 > div.container.b4 > div:nth-child(1) > div > div.e0 > div.d0.c7 > div.k2v > div > div > div > div.u7k > div:nth-child(2) > div > span
                      let cost = element.querySelector(
                        "#layoutPage > div.b0 > div.container.b4 > div:nth-child(1) > div > div.e0 > div.d0.c7 > div.k2v > div > div > div > div.u7k > div:nth-child(2) > div > span"
                      );
                      return {
                        cost: cost
                          ? cost.textContent.replace(
                              /[\t\n\v\f\r \u00a0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000₽]/g,
                              ""
                            )
                          : "",
                      };
                    });
                  }
                );
              } catch (error) {
                // await browser.close();
                console.log(
                  `\tERROR: Поле с ценой у распроданного товара было обновлёно (Ozon)!`
                );
                throw error;
              }

              if (soldoutCost[0].cost === "") {
                // await browser.close();
                console.log(
                  `\tERROR: Некоторые собранные данные - пустые строки (Ozon)!`
                );
                continue;
                // throw error;
              } else {
                const findQuery = `SELECT * FROM products WHERE product_url='${product}'`;
                database.query(findQuery, async (err, results) => {
                  if (err) throw err;

                  if (results.rows[0].product_cost !== soldoutCost[0].cost) {
                    let dateObj = new Date();
                    let parseDate = dateObj.toISOString().split("T")[0];

                    let dbDate = new Date(
                      results.rows[0].parse_date.toString()
                    );
                    let w = dbDate.getTimezoneOffset() * 60000;
                    let dbDate_correct = new Date(dbDate.getTime() - w)
                      .toISOString()
                      .split("T")[0];
                    if (dbDate_correct !== parseDate) {
                      console.log(
                        `\tINFO: У товара ${
                          results.rows[0].product_url
                        }\nИЗМЕНИЛАСЬ цена (${+results.rows[0]
                          .product_cost} -> ${+soldoutCost[0].cost}).`
                      );
                      const insertLog = `INSERT INTO products_log (product_id, product_cost, parse_date, shop) SELECT product_id, ${+soldoutCost[0]
                        .cost}, '${parseDate}', shop FROM products WHERE product_url='${product}'`;
                      const update = `UPDATE products SET product_cost=${+soldoutCost[0]
                        .cost}, parse_date='${parseDate}' WHERE product_url='${product}'`;

                      database.query(insertLog, async (e) => {
                        if (e) throw e;
                        database.query(update, async (e) => {
                          if (e) throw e;
                        });
                      });
                    } else {
                      console.log(
                        `\tINFO: У товара ${
                          results.rows[0].product_url
                        }\nцена МОГЛА ИЗМЕНИТЬСЯ, но данные уже были сегодня записаны в БД (${+results
                          .rows[0].product_cost} -> ${+soldoutCost[0].cost}).`
                      );
                    }
                  } else {
                    console.log(
                      `\tINFO: У товара ${
                        results.rows[0].product_url
                      }\nНЕ ИЗМЕНИЛАСЬ цена (${+results.rows[0]
                        .product_cost} -> ${+soldoutCost[0].cost}).`
                    );
                  }
                });
              }
              continue;
            }

            //! Товар есть в наличии
            try {
              const productField = giveSelector(
                  0,
                  "product check field",
                  pageStyle,
                  shop
                ),
                productPriceField = giveSelector(
                  0,
                  "price check field",
                  pageStyle,
                  shop
                );

              //! Не устарели ли селекторы?
              try {
                await page.waitForSelector(productField, {
                  timeout: 2000,
                });
              } catch (error) {
                try {
                  // #layoutPage > div.b0 > div.container.b4 > div.p7k.qk2 > div.p7k.qk3.qk0.q0k > div.p7k.qk3.qk0.kq1 > div.l2n.n2j > div > div > div.nl2 > div > div > div.xk3.k5x.x6k > div > span.k4x.xk4 > span
                  await page.waitForSelector(
                    `#layoutPage > div.b0 > div.container.b4 > div.p8k.qk3`,
                    {
                      timeout: 2000,
                    }
                  );
                  // hasNextPage = false;
                  // break;
                } catch (error) {
                  await browser.close();
                  console.log(
                    `\tERROR: Селектр у поля с товаром был обновлён (Ozon) [Категория: ${result.rows[i].product_category}]!`
                  );
                  throw error;
                }
              }

              try {
                await page.waitForSelector(productPriceField, {
                  timeout: 2000,
                });
              } catch (error) {
                try {
                  await page.waitForSelector(
                    `#layoutPage > div.b0 > div.container.b4 > div.p8k.qk3 > div.p8k.qk4.qk1.q1k > div.p8k.qk4.qk1.kq2 > div > div > div > div.l4n > div > div > div > div > span > span`,
                    {
                      timeout: 2000,
                    }
                  );
                } catch (error) {
                  try {
                    await page.waitForSelector(
                      `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3) > div:nth-child(3) > div > div.ln4.n2j > div > div > div.l4n > div > div > div > div > span > span`,
                      {
                        timeout: 2000,
                      }
                    );
                  } catch (error) {
                    try {
                      await page.waitForSelector(
                        `#layoutPage > div.b0 > div.container.b4 > div:nth-child(3) > div.d1.c7 > div > div > div > div > div:nth-child(2) > div > div > div > div.l4n > div > div > div > div > span > span`,
                        {
                          timeout: 2000,
                        }
                      );
                    } catch (error) {
                      // await browser.close();
                      console.log(
                        `\tERROR: Селектр у поля с ценой товара был обновлён (Ozon) [Категория: ${result.rows[i].product_category}]\n[Товар: ${result.rows[i].product_url}]!`
                      );
                      continue;
                      // throw error;
                    }
                  }
                }
              }

              //! Извлечение данных
              const products = [];
              try {
                products = await page.$$eval(productField, (elements) => {
                  return elements.map((element) => {
                    let cost = element.querySelector(".kx6.k6x span");
                    if (cost == null) cost = element.querySelector(".kx6");
                    if (cost == null)
                      cost = element.querySelector(
                        "#layoutPage > div.b0 > div.container.b4 > div.p8k.qk3 > div.p8k.qk4.qk1.q1k > div.p8k.qk4.qk1.kq2 > div.ln4.n2j > div > div > div.l4n > div > div > div.k5x.kx7.xk8 > div > span.kx6.k6x > span"
                      );
                    return {
                      cost: cost
                        ? cost.textContent.replace(
                            /[\t\n\v\f\r \u00a0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000₽]/g,
                            ""
                          )
                        : "",
                    };
                  });
                });
              } catch (error) {
                await browser.close();
                console.log(`\tERROR: Поле(-я) товаров были обновлёны (Ozon)!`);
                throw error;
              }

              // ! Проверка собранных данных
              if (products[0].cost === "") {
                // await browser.close();
                console.log(
                  `\tERROR: Некоторые собранные данные - пустые строки (Ozon)!`
                );
                continue;
                // throw error;
              } else {
                //! Запись данных в БД (с учётом даты)
                const findQuery = `SELECT * FROM products WHERE product_url='${product}'`;
                database.query(findQuery, async (err, results) => {
                  if (err) throw err;

                  if (results.rows[0].product_cost !== products[0].cost) {
                    let dateObj = new Date();
                    let parseDate = dateObj.toISOString().split("T")[0];

                    let dbDate = new Date(
                      results.rows[0].parse_date.toString()
                    );
                    let w = dbDate.getTimezoneOffset() * 60000;
                    let dbDate_correct = new Date(dbDate.getTime() - w)
                      .toISOString()
                      .split("T")[0];
                    if (dbDate_correct !== parseDate) {
                      console.log(
                        `\tINFO: У товара ${
                          results.rows[0].product_url
                        }\nИЗМЕНИЛАСЬ цена (${+results.rows[0]
                          .product_cost} -> ${+products[0].cost}).`
                      );
                      const insertLog = `INSERT INTO products_log (product_id, product_cost, parse_date, shop) SELECT product_id, ${+products[0]
                        .cost}, '${parseDate}', shop FROM products WHERE product_url='${product}'`;
                      const update = `UPDATE products SET product_cost=${+products[0]
                        .cost}, parse_date='${parseDate}' WHERE product_url='${product}'`;

                      database.query(insertLog, async (e) => {
                        if (e) throw e;
                        database.query(update, async (e) => {
                          if (e) throw e;
                        });
                      });
                    } else {
                      console.log(
                        `\tINFO: У товара ${
                          results.rows[0].product_url
                        }\nцена МОГЛА ИЗМЕНИТЬСЯ, но данные уже были сегодня записаны в БД (${+results
                          .rows[0].product_cost} -> ${+products[0].cost}).`
                      );
                    }
                  } else {
                    console.log(
                      `\tINFO: У товара ${
                        results.rows[0].product_url
                      }\nНЕ ИЗМЕНИЛАСЬ цена (${+results.rows[0]
                        .product_cost} -> ${+products[0].cost}).`
                    );
                  }
                });
              }
            } catch (error) {
              console.log("sdsf");
              throw error;
            }
          }
        });
      }

      if (shop == "Leroy Merlin") {
      }
    });
}

//! НУЖНО РАСКОММЕНТИРОВАТЬ РОВНО ОДИН ИЗ СЕГМЕНТОВ НИЖЕ!

//!~~ Сбор новых данных с сайтов интернет-магазинов ~~~~~~~~~~~~~
// parseProducts("Ozon")
//   .then(() => {
//     console.log(`\t...\n\tINFO: Идёт сбор данных о товарах...`);
//   })
//   .catch((err) => {
//     console.log("\n\tERROR: Ошибка при ПЕРВИЧНОМ сборе данных!");
//   });
//!~~ Проверка собранных данных ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// databaseDeleteInvalidData().then(() => {
//   console.log(`\t...\n\tSUCCESS: Данные о товарах актуальны!`);
// }).catch((error) => {
//   console.log("\n\tERROR: Ошибка при проверке собранных данных!");
//   throw error;
// });;
//!~~ Обновление собранных данных ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// checkData("Ozon")
//   .then(() => {
//     console.log(
//       `\t...\n\INFO: Данные о товарах обновляются! Ожидание может быть до 12 минут...`
//     );
//   })
//   .catch((error) => {
//     console.log("\n\tERROR: Ошибка при обновлении собранных данных!");
//     throw error;
//   });
//!~~ Проверка собранных данных и их обновление ~~~~~~~~~~~~~~~~~
databaseDeleteInvalidData()
  .then(() => {
    countDaysforCategories("Ozon").then(() => {
      console.log(`\t...\n\tINFO: Данные о товарах актуальны!`);
      // Ozon, Leroy
      checkData("Ozon")
        .then(() => {
          console.log("\n\tINFO: Данные обновляются...");
        })
        .catch((error) => {
          console.log("\n\tERROR: Ошибка при ВТОРИЧНОМ сборе данных!");
          throw error;
        });
    });
  })
  .catch((err) => {
    console.log("\n\tERROR: Ошибка при обновлении/проверке собранных данных!");
    throw err;
  });
