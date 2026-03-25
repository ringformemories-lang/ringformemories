/* ============================================================
   RING FOR MEMORIES — Script
   ============================================================ */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     NAV: scroll class + smooth offset for fixed nav
  ---------------------------------------------------------- */
  var nav = document.getElementById("nav");
  var NAV_H = 66;

  function onScroll() {
    if (window.scrollY > 10) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Smooth-scroll anchor links with offset for fixed nav
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - NAV_H;
      window.scrollTo({ top: top, behavior: "smooth" });

      // Close mobile menu if open
      closeMobileMenu();
    });
  });

  /* ----------------------------------------------------------
     MOBILE MENU HAMBURGER
  ---------------------------------------------------------- */
  var hamburger = document.querySelector(".nav-hamburger");
  var mobileMenu = document.querySelector(".nav-mobile-menu");

  function closeMobileMenu() {
    if (mobileMenu.classList.contains("open")) {
      mobileMenu.classList.remove("open");
      nav.classList.remove("menu-open");
      hamburger.setAttribute("aria-expanded", "false");
    }
  }

  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", function () {
      var isOpen = mobileMenu.classList.toggle("open");
      hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      // Force white nav background when menu is open (even over hero)
      if (isOpen) {
        nav.classList.add("menu-open");
      } else {
        nav.classList.remove("menu-open");
      }
    });

    // Close on outside click
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) {
        closeMobileMenu();
      }
    });
  }

  /* ----------------------------------------------------------
     GALLERY LIGHTBOX
  ---------------------------------------------------------- */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxClose = document.querySelector(".lightbox-close");

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
    lightboxImg.src = "";
  }

  document.querySelectorAll(".gallery-item").forEach(function (item) {
    item.addEventListener("click", function () {
      var src = item.getAttribute("data-src");
      var alt = item.querySelector("img") ? item.querySelector("img").alt : "";
      openLightbox(src, alt);
    });
    item.setAttribute("tabindex", "0");
    item.setAttribute("role", "button");
    item.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        item.click();
      }
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lightbox.classList.contains("open")) {
        closeLightbox();
      }
    });
  }

  /* ----------------------------------------------------------
     AUDIO / PLAY BUTTONS (placeholder behaviour)
  ---------------------------------------------------------- */
  document.querySelectorAll(".play-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      // No audio files provided — show a gentle notice
      var label = btn.closest(".audio-card")
        ? btn.closest(".audio-card").querySelector(".audio-label")
        : null;
      var name = label ? label.textContent.trim() : "this message";
      alert(
        "Audio playback for " +
          name +
          " is not available in this demo.\n\nContact ringformemories@gmail.com to hear these memories."
      );
    });
  });

  /* ----------------------------------------------------------
     CONTACT FORM — basic client-side validation
  ---------------------------------------------------------- */
  var contactForm = document.querySelector(".contact-form");
  var formSuccess = document.querySelector(".form-success");

  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var firstName = contactForm.querySelector('[name="first_name"]').value.trim();
      var lastName = contactForm.querySelector('[name="last_name"]').value.trim();
      var email = contactForm.querySelector('[name="email"]').value.trim();
      var message = contactForm.querySelector('[name="message"]').value.trim();

      if (!firstName || !lastName || !email || !message) {
        if (formSuccess) {
          formSuccess.textContent = "Please fill in all fields.";
          formSuccess.style.color = "rgba(0,0,0,0.7)";
        }
        return;
      }

      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) {
        if (formSuccess) {
          formSuccess.textContent = "Please enter a valid email address.";
          formSuccess.style.color = "rgba(0,0,0,0.7)";
        }
        return;
      }

      // Disable submit while sending
      var submitBtn = contactForm.querySelector(".submit-btn");
      if (submitBtn) submitBtn.disabled = true;

      fetch("/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email,
          message: message,
        }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.ok) {
            if (formSuccess) {
              formSuccess.textContent = "Thank you, " + firstName + "! We'll be in touch soon.";
              formSuccess.style.color = "#000000";
            }
            contactForm.reset();
          } else {
            if (formSuccess) {
              formSuccess.textContent = data.error || "Something went wrong. Please try again.";
              formSuccess.style.color = "rgba(0,0,0,0.7)";
            }
          }
        })
        .catch(function () {
          if (formSuccess) {
            formSuccess.textContent = "Failed to send. Please email us directly at ringformemories@gmail.com";
            formSuccess.style.color = "rgba(0,0,0,0.7)";
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }
  /* ----------------------------------------------------------
     GALLERY CAROUSEL
  ---------------------------------------------------------- */
  var track = document.getElementById("galleryTrack");
  var dotsContainer = document.getElementById("carouselDots");

  if (track) {
    var slides = track.querySelectorAll(".carousel-slide");
    var slidesPerView = 3;
    var totalSlides = slides.length;
    var currentIndex = 0;

    // Build dots
    slides.forEach(function(_, i) {
      var dot = document.createElement("button");
      dot.className = "carousel-dot" + (i === 0 ? " active" : "");
      dot.setAttribute("aria-label", "Go to slide " + (i + 1));
      dot.addEventListener("click", function() { goTo(i); });
      dotsContainer.appendChild(dot);
    });

    function updateDots() {
      var dots = dotsContainer.querySelectorAll(".carousel-dot");
      dots.forEach(function(d, i) {
        d.classList.toggle("active", i === currentIndex);
      });
    }

    function goTo(index) {
      var maxIndex = totalSlides - slidesPerView;
      if (maxIndex < 0) maxIndex = 0;
      currentIndex = Math.max(0, Math.min(index, maxIndex));
      var offset = currentIndex * (100 / slidesPerView);
      track.style.transform = "translateX(-" + offset + "%)";
      updateDots();
    }

    document.querySelector(".carousel-prev").addEventListener("click", function() {
      goTo(currentIndex - 1);
    });

    document.querySelector(".carousel-next").addEventListener("click", function() {
      goTo(currentIndex + 1);
    });

    // Lightbox on carousel slides
    slides.forEach(function(slide) {
      slide.addEventListener("click", function() {
        var src = slide.getAttribute("data-src");
        var img = slide.querySelector("img");
        openLightbox(src, img ? img.alt : "");
      });
    });

    // Adjust per view on resize
    function onResize() {
      slidesPerView = window.innerWidth < 860 ? 1 : 3;
      goTo(currentIndex);
    }
    window.addEventListener("resize", onResize);
    onResize();
  }

  /* ----------------------------------------------------------
     SCROLL ANIMATIONS — IntersectionObserver
  ---------------------------------------------------------- */
  // Add class to body so CSS knows JS is running — elements hide only after this
  document.body.classList.add("js-anim");

  var animEls = document.querySelectorAll(
    ".anim-fade-up, .anim-fade-in, .anim-fade-left, .anim-fade-right"
  );

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    animEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: just show everything
    animEls.forEach(function (el) {
      el.classList.add("revealed");
    });
  }

})();
