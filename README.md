Clip Paint - Paint in the Browser
---
https://clippaint.com/

# Motivation
Clip Paint is a JavaScript web app reproducing MS Paint functionality and UX in the Browser.
I use it to create screenshots for blog posts and bug reporting.
It is work in progress. Currently, selection capabilities work.
To be added are drawing figures and text.

# Running locally
Fork and clone the repo. Then simply open the `index.html` file in your browser.
The entire app is client-side. Nothing runs on a server.

# Cool technologies used
Clip Paint is entirely in the browser and in JavaScript. No dependencies on a CLI or back-end.

## Clipboard APIs
Copy and pasting via keyboard shortcuts Ctrl+c and Ctrl+v are supported in the browser.
Clip Paint tries to leverage that as much as possible.
There is one limitation however - it is not possible to copy an image to the clipboard.
Therefore, you must press the download button to obtain the final PNG.

Fortunately however, copy/paste codes work in the web app.
You see I copy the image base64 representation onto the clipboard as `text/plain`.
In paste events I can grab that.

## Canvas and SVG
The web app uses Canvas and SVG. They serve different purposes.
The canvas, just as the name implies, is the drawing canvas.
SVG is used to handle human interactions.
For instance drawing a select box, clipping an image, dragging an image, dropping an image and canvas resize.
Thanks to [Ulrich-Matthias](https://github.com/Fuzzyma) for building the excellent [svg.js](https://svgjs.com) library.
It greatly simplified implementing these operations.

## Client-side download
Its easy to attach a base64 data url to an anchor tag. However there is a top limit different per browser.
Fortunately [dandavis](https://github.com/rndme) wrote [download.js](http://danml.com/download.html) to solve this problem.
Even a large file can be downloaded client-side very easily.

## Client-size image resize
Image resize on HTML canvas really sucks.
Thanks to [Vilius](https://github.com/viliusle) for writing a helpful image resize function called [hermite.js](https://github.com/viliusle/Hermite-resize).
Pixel-perfect image resize was essential. MS Paint doesn't even have that.

# Code
The entire app is contained within one file `app.js`. It is self documented.

# Dependencies
Clip Paint does depend on a number of other libraries. These are:
- [Bootstrap 4](https://getbootstrap.com/docs/4.0/getting-started/introduction/)
- [jQuery 3](http://jquery.com/) (slim version)
- [FontAwesome 4](https://fontawesome.com/v4.7.0/icons/)
- [svg.js](https://svgjs.com/) and a few plugins
- [hermite.js](https://github.com/viliusle/Hermite-resize) for image resize
- [download.js](http://danml.com/download.html) to download image

