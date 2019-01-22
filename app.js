$(document).ready(function() {

  // The content div contains everything
  var $content = $('.content');

  // The canvas is what we draw on
  var canvas = $('canvas')[0];
  var ctx = canvas.getContext('2d');

  // The img is an intermediate element to capture pasted images
  var img = $('img').hide()[0];

  // We use SVG elements via svg.js for bounding boxes, resize,
  // drag and drop, etc...
  var draw = SVG('drawing').size(0, 0);



  // ==========================================================================
  //
  // PASTING FROM CLIPBOARD
  //
  // Using the Clipboard API, we can detect paste events (Ctrl+v) and create
  // a new selection of the copied image.
  //
  // We support binary images (mime type image/png|jpg|gif) and base64 encoded
  // images in plain/text mime type. These are called data urls and can be
  // used to embed inline in the src attribute of images. Look at function
  // copySelectionToClipboard to learn more.
  //
  // ==========================================================================
  var $message = $('.message');
  var timeoutId;

  $message.first().html('Copy your screen by pressing on the Print Screen key. Then paste (Ctrl+v) it here as an image.');
  function showMessage(message, reset) {
    if (timeoutId) clearTimeout(timeoutId);
    $message.html(message);
    if (reset) {
      timeoutId = setTimeout(function() {
        $message.html('Paste (Ctrl+v) your image');
        timeoutId = undefined;
      }, 2000);
    }
  }

  function loadImageFromDataUrl(dataUrl) {
    var deferred = new $.Deferred();
    var onload = function() {
      $content.addClass('has-image');
      showMessage('Image pasted. You can paste again to replace.');
      setTimeout(function() {
        deferred.resolve();
      }, 25);
    }

    if (img.src == dataUrl) {
      onload();
    } else {
      img.onload = onload;
      img.src = dataUrl;
    }

    return deferred;
  }

  function loadImageFromFile(file) {
    var deferred = new $.Deferred();
    var reader = new FileReader();

    showMessage('Loading image...');
    reader.onload = function(e) {
      img.src = e.target.result;
      $content.addClass('has-image');
      showMessage('Image pasted. You can paste again to replace.');
      setTimeout(function() {
        deferred.resolve();
      }, 25);
    };
    reader.readAsDataURL(file);
    return deferred;
  };

  function copyImageInCanvas() {
    showMessage('Copying to canvas...');
    if (canvas.width < img.naturalWidth || canvas.height < img.naturalHeight)
      setCanvasSize(Math.max(canvas.width, img.naturalWidth), Math.max(canvas.height, img.naturalHeight));
    createSelection(0, 0, img.naturalWidth, img.naturalHeight, img.src);
    showMessage('Image pasted. You can paste again to replace.');
  }

  var IMAGE_MIME_REGEX = /^image\/(p?jpeg|gif|png)$/i;
  $(document).on('paste', function(e) {
    if (!e.originalEvent.clipboardData || !e.originalEvent.clipboardData.items) return;

    var items = e.originalEvent.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
      if (IMAGE_MIME_REGEX.test(items[i].type)) {
        cancelSelection();
        loadImageFromFile(items[i].getAsFile()).done(copyImageInCanvas);
        return;
      }
      if (items[i].type == 'text/plain') {
        items[i].getAsString(function(text) {
          if (text.indexOf('data:image/png;base64,') === 0) {
            loadImageFromDataUrl(text).done(copyImageInCanvas);
            return;
          }
          showMessage('No image found on your Clipboard!', true);
        });
        return;
      }
      showMessage('No image found on your Clipboard!', true);
    }
  });




  // ==========================================================================
  //
  // CANVAS RESIZE
  //
  // SVG element crect is the canvas bounding box with handles to resize.
  // It is only shown when there is no selection.
  //
  // ==========================================================================
  var crect;

  function getMousePosition(e) {
    return {
      x: Math.round(e.pageX) - $content.offset().left - 5,
      y: Math.round(e.pageY) - $content.offset().top - 5
    };
  }

  function renderCanvasSizeAndMousePosition(m) {
    var $size = $('.image-size');
    $size.html(canvas.width + ' x ' + canvas.height);
    if (m) {
      var $mouse = $('.mouse-position');
      $mouse.html(m.x + ', ' + m.y);
    }
  }

  function setCanvasSize(width, height) {
    var imageData = ctx.getImageData(0, 0, Math.min(width, canvas.width), Math.min(height, canvas.height));
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
    crect.size(width, height);
    draw.size(width+5, height+5);
    renderCanvasSizeAndMousePosition();
  }

  function allowCanvasResize(allow) {
    var allowed = !!crect.remember('allowResize');

    if (allow === undefined) return allowed;

    if (allow === true && !allowed) {
      crect.remember('allowResize', true)
        .selectize({
          points: ['rb', 'r', 'b'],
          rotationPoint: false,
          pointType: 'rect'
        })
        .resize();
    }

    if (allow === false && allowed) {
      crect.forget('allowResize').resize('stop').selectize(false);
    }
  }

  function initCanvas(width, height) {
    crect = draw.rect(canvas.width, canvas.height)
      .addClass('canvas')
      .on('resizing', function() {
        draw.size(crect.width()+5, crect.height()+5);
      })
      .on('resizedone', function() {
        setCanvasSize(crect.width(), crect.height());
      });
    setCanvasSize(width, height);
    allowCanvasResize(true);
  }
  initCanvas(window.innerWidth-30, window.innerHeight-56-40-10);



  // ==========================================================================
  //
  // SELECTION
  //
  // SVG element srect is the selection rectangle. It is resizable and
  // draggable.
  // SVG element simage is the selected image. 
  //
  // ==========================================================================
  var srect, simage;

  function getDataUrlFromCanvas(x, y, width, height) {
    var imageData = ctx.getImageData(x, y, width, height);
    var tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = width;
    tmpCanvas.height = height;
    tmpCanvas.getContext('2d').putImageData(imageData, 0, 0);
    var dataUrl = tmpCanvas.toDataURL('image/png');
    tmpCanvas.remove();
    return dataUrl;
  }

  // Copies the data url as text/plain mime type.
  // It is not possible to copy an image/png mime type unfortunately.
  // Using text/plain we can handle copy/paste events within this app.
  // Even in new instances of it.
  function copySelectionToClipboard() {
    var t = (new Date()).getTime();
    var str = simage ? simage.src : getDataUrlFromCanvas(0, 0, canvas.width, canvas.height);

    if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(str);
      return;
    }

    var $textarea = $('<input style="position:absolute;left:-9999px;opacity:0;" readonly autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />');
    $('body').append($textarea);
    $textarea.val(str);
    $textarea[0].select();
    document.execCommand('copy');
    $textarea.remove();
  }

  function renderSelectionSizeAndMousePosition() {
    var $selection = $('.selection');
    if (srect) 
      $selection.html(srect.x() + ', ' + srect.y() + ' : ' + Math.round(srect.width()) + ' x ' + Math.round(srect.height()));
    else
      $selection.empty();
  }

  function createSelection(x, y, width, height, fromDataUrl) {
    if (!srect) srect = draw.rect(0, 0).addClass('select');
    srect.x(x).y(y).width(width).height(height);

    // Create image node and put it before
    var dataUrl = fromDataUrl || getDataUrlFromCanvas(x, y, width, height);
    simage = draw.image(dataUrl, width, height);
    simage.x(srect.x()).y(srect.y());
    srect.before(simage);

    if (!fromDataUrl) {
      // Erase area on the canvas
      ctx.clearRect(x, y, width, height);
    }

    if (!srect.remember('selected')) {
      // Allow resize and dragging of selection rectangle
      srect.forget('start')
        .remember('selected', true)
        .selectize({
          rotationPoint: false,
          pointType: 'rect',
          points: ['lt', 'rt', 'rb', 'lb']
        })
        .resize({
          saveAspectRatio: true,
          constraint: {minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height}
        })
        .draggable()
        .on('dragmove', function() {
          // Reposition image
          setTimeout(function() {
            simage.x(srect.x()).y(srect.y());
          },1);
        });
    }

    if (allowCanvasResize()) allowCanvasResize(false);
    renderSelectionSizeAndMousePosition();
    $content.addClass('has-image');
  }

  function cancelSelection(preventDrop) {
    if (!srect) return;

    if (srect.remember('start')) {
      srect.remove();
      srect = undefined;
      return;
    }

    if (srect.remember('selected')) srect.draggable(false).resize('stop').selectize(false);
    srect.remove();
    srect = undefined;

    if (simage) {
      // Drop the image on canvas
      if (!preventDrop) ctx.drawImage(simage.node, simage.x(), simage.y());
      simage.remove();
      simage = undefined;
    }

    allowCanvasResize(true);
    renderSelectionSizeAndMousePosition();
  }

  function onMouseDown(e) {
    if ($(e.target).is('nav')) return;

    var m = getMousePosition(e);
    if (srect) {
      if (srect.inside(m.x, m.y)) return;
      cancelSelection();
    }

    // Start creating selection
    var x = Math.min(Math.max(0, m.x), canvas.width);
    var y = Math.min(Math.max(0, m.y), canvas.height);
    srect = draw.rect(0, 0);
    srect.x(x).y(y);
    srect.addClass('select');
    srect.remember('start', {x: x, y: y});
    renderSelectionSizeAndMousePosition();
    $content.addClass('has-image');
  }

  function onMouseMove(e) {
    var m = getMousePosition(e);
    if (srect) {
      var start = srect.remember('start');
      if (start) {
        var x = Math.min(Math.max(0, Math.min(start.x, m.x)), canvas.width);
        var y = Math.min(Math.max(0, Math.min(start.y, m.y)), canvas.height);
        var width = Math.max(0, Math.max(start.x, m.x) - x);
        var height = Math.max(0, Math.max(start.y, m.y) - y);
        if (x+width > canvas.width) width = canvas.width - x;
        if (y+height > canvas.height) height = canvas.height - y;
        srect.x(x).y(y).width(width).height(height);
        if (allowCanvasResize()) allowCanvasResize(false);
      }
    }
    renderCanvasSizeAndMousePosition(m);
    renderSelectionSizeAndMousePosition();
  }

  function onMouseUp(e) {
    var m = getMousePosition(e);
    if (srect && srect.remember('start')) {
      if (srect.width() == 0 || srect.height() == 0) {
        cancelSelection();
        return;
      }
      createSelection(srect.x(), srect.y(), Math.round(srect.width()), Math.round(srect.height()));
    }
  }

  function onKeyDown(e) {
    switch (e.keyCode) {
      case 27: // Esc
        e.preventDefault();
        cancelSelection();
        break;
      case 46: // Delete
      case 8: // Backspace
        e.preventDefault();
        cancelSelection(true);
        break;
      case 67: // Ctrl + c
        if (e.ctrlKey) {
          e.preventDefault();
          if (simage) copySelectionToClipboard();
        }
        break;
      case 65: // Ctrl + a
        if (e.ctrlKey) {
          e.preventDefault();
          cancelSelection();
          createSelection(0, 0, canvas.width, canvas.height);
        }
        break;
      case 88: // Ctrl + x
        if (e.ctrlKey) {
          e.preventDefault();
          if (simage) {
            copySelectionToClipboard();
            cancelSelection(true);
          }
        }
        break;
    }
  }

  $(document).on('mousemove', onMouseMove);
  $(document).on('mousedown', onMouseDown);
  $(document).on('mouseup', onMouseUp);
  $(document).on('keydown', onKeyDown);

});