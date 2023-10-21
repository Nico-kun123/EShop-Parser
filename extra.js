"use strict"; // Строгий режим

// ~~[ Sticky Navbar ]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// When the user scrolls the page, execute myFunction
window.onscroll = function () {
  myFunction();
};

// Get the navbar
let navbar = document.getElementById("navbar");

// Get the offset position of the navbar
let sticky = navbar.offsetTop;

// Add the sticky class to the navbar when you reach its scroll position. Remove "sticky" when you leave the scroll position
function myFunction() {
  if (window.pageYOffset >= sticky) {
    navbar.classList.add("sticky");
  } else {
    navbar.classList.remove("sticky");
  }
}

// ~~[ Показать/Скрыть статистику категории ]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function toggleCategory(category, button) {
  let x = document.querySelector(category);
  let y = document.getElementById(button);
  if (x.style.display === "none" || window.getComputedStyle(x).display === "none") {
    x.style.display = "block";
    y.textContent = "СКРЫТЬ"
  } else {
    x.style.display = "none";
    y.textContent = "ПОКАЗАТЬ"
  }
}

// ~~[ Показать/Скрыть статистику категории ]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Прокручивание страницы наверх при нажатии на кнопку
$(window).scroll(function() {
  var height = $(window).scrollTop();
  if (height > 100)
      $('#back2Top').fadeIn();
      else $('#back2Top').fadeOut();
});
$(document).ready(function() {
  $("#back2Top").click(function(event) {
      event.preventDefault();
      $("html, body").animate({ scrollTop: 0 }, "slow");
      return false;
  });
});