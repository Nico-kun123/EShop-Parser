<h1 style="color: orange;">СЕРВИС СБОРА ДАННЫХ ТОВАРОВ С САЙТОВ ИНТЕРНЕТ-МАГАЗИНОВ</h1>

> **Примечание:** Этот проект требует постоянного обновления кода из-за изменения названий селекторов на сайтах интернет-магазинов. Если код не обновлять, то сервис перестанет собирать данные с сайтов!

## Содержание

- [Введение](#введение)
- [Цели и Задачи](#-цели-и-задачи)
- [Технологии](#технологии)
- [Установка](#установка)
  
# Введение

Сбор информации в интернете — трудоёмкая, отнимающая много времени работа. Для решения подобной задачи можно использовать парсеры, которые способны в течение суток перебрать большую часть веб-ресурсов в поисках нужной информации и автоматизировать эту информацию.

Сервисы, предоставляющие услуги мониторинга цен и «парсинга» данных, в основном представляют собой веб-сайт, где есть возможность делать запросы на получение данных о товарах и экспортировать их в форматах CSV, PDF, XML.

# ❗ Цели и Задачи

Целью данной работы является разработка сервиса для сбора данных товаров с интернет-магазинов. 

Сервис должен решать следующие задачи:
1. Сбор данных с сайтов интернет-магазинов.
2. Сбор данных о ценах товаров, которые уже хранятся в базе данных для того, чтобы показать, как цена данных товаров меняется каждый день.
3. Хранение данных о пользователях и товарах в базе данных.
4. Проверка собранных данных на актуальность (например, если URL товара недействительна, то все записи об этом товаре будут удалены).
5. Отображение собранных данных товаров в виде графиков для мониторинга динамики изменения цен у категорий.
6. Возможность пользователя выбирать конкретную категорию товаров, данные о товарах которой он желает получить. Пользователь также может выбрать все категории товаров, а не одну конкретную категорию.
7. Возможность экспорта собранных данных в виде файла в форматах CSV, XML и PDF.

## Скриншоты

Если у вас есть скриншоты вашего приложения, вставьте их здесь.

## Технологии

Укажите использованные технологии, библиотеки и инструменты.

## Установка

Подробное описание того, как установить и настроить ваш проект.

Клонируем удалённый репозиторий на локальную машину:
```markdown
git clone https://github.com/Nico-kun123/TESTING
```
Устанавливаем все необходимые компоненты:
``` markdown
npm install
```
## Автор

Кудрявцев Николай (Электронная почта: nicolay.kudryavtsev@gmail.com)
