$(document).ready(function() {

  var $content = $('.content');
  var $canvas = $('canvas');


  // Pasting an image
  var $img = $('img').hide();
  var img = $img[0];
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

  function loadImage(file) {
    var deferred = new $.Deferred();
    var reader = new FileReader();

    showMessage('Loading image...');
    reader.onload = function(e) {
      $img.show();
      $img.attr('src', e.target.result);
      $canvas.hide();
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
    setCanvasSize(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0);
    $img.hide();
    $canvas.show();
    createSelection(0, 0, canvas.width, canvas.height);
    showMessage('Image pasted. You can paste again to replace.');
  }

  var IMAGE_MIME_REGEX = /^image\/(p?jpeg|gif|png)$/i;
  $(document).on('paste', function(e) {
    if (!e.originalEvent.clipboardData || !e.originalEvent.clipboardData.items) return;

    var items = e.originalEvent.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
      if (IMAGE_MIME_REGEX.test(items[i].type)) {
        loadImage(items[i].getAsFile()).done(copyImageInCanvas);
        return;
      }
      showMessage('No image found on your Clipboard!', true);
    }
  });


  function getMousePosition(e) {
    return {
      x: Math.round(e.pageX - $content.offset().left - 5),
      y: Math.round(e.pageY - $content.offset().top - 5)
    };
  }


  // Canvas resize
  var draw, crect;
  var canvas = $canvas[0];
  var ctx = canvas.getContext('2d');

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
    draw = SVG('drawing').size(0, 0);
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


  // Selection
  var srect, simage;

  function getBase64ImageFromCanvas(x, y, width, height) {
    var imageData = ctx.getImageData(x, y, width, height);
    var tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = width;
    tmpCanvas.height = height;
    tmpCanvas.getContext('2d').putImageData(imageData, 0, 0);
    var dataUrl = tmpCanvas.toDataURL('image/png');
    tmpCanvas.remove();
    return dataUrl;
  }

  function renderSelectionSizeAndMousePosition() {
    var $selection = $('.selection');
    if (srect) 
      $selection.html(srect.x() + ', ' + srect.y() + ' : ' + Math.round(srect.width()) + ' x ' + Math.round(srect.height()));
    else
      $selection.empty();
  }

  function createSelection(x, y, width, height) {
    if (!srect) srect = draw.rect(0, 0).addClass('select');
    srect.x(x).y(y).width(width).height(height);

    // Create image node and put it before
    var dataUrl = getBase64ImageFromCanvas(x, y, width, height);
    simage = draw.image(dataUrl, width, height);
    simage.x(srect.x()).y(srect.y());
    srect.before(simage);

    // Erase area on the canvas
    ctx.clearRect(x, y, width, height);

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

  function cancelSelection() {
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
      ctx.drawImage(simage.node, simage.x(), simage.y());
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
      createSelection(srect.x(), srect.y(), srect.width(), srect.height());
    }
  }

  function onKeyDown(e) {
    if (e.keyCode == 27) cancelSelection();
  }

  $(document).on('mousemove', onMouseMove);
  $(document).on('mousedown', onMouseDown);
  $(document).on('mouseup', onMouseUp);
  $(document).on('keydown', onKeyDown);

});