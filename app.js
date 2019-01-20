$(document).ready(function() {

  var $content = $('.content');
  var $canvas = $('canvas').hide();
  var canvas = $canvas[0];
  var ctx = canvas.getContext("2d");
  var draw = SVG('drawing').size(0, 0);


  var $message = $('.message');
  $message.first().html('Copy your screen by pressing on the Print Screen key. Then paste (Ctrl+v) it here as an image.');
  var timeoutId;
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

  var $img = $('img').hide();
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

  var $size = $('.image-size');
  function copyImageInCanvas() {
    var image = $img[0];

    showMessage('Copying to canvas...');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    draw.size(canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    $img.hide();
    $canvas.show();
    showMessage('Image pasted. You can paste again to replace.');
    $size.html(image.naturalWidth + ' x ' + image.naturalHeight);
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


  var rect;
  var $selection = $('.selection');
  var $mouse = $('.mouse-position');
  function getMousePosition(e) {
    return {
      x: Math.round(e.pageX - $content.offset().left - 5),
      y: Math.round(e.pageY - $content.offset().top - 5)
    };
  }

  function renderSelection() {
    if (rect) 
      $selection.html(rect.x() + ', ' + rect.y() + ' : ' + rect.width() + ' x ' + rect.height());
    else
      $selection.empty();
  }

  function onMouseDown(e) {
    var m = getMousePosition(e);
    if (rect) {
      if (rect.inside(m.x, m.y)) return;
      rect.draggable(false)
        .resize('stop')
        .selectize(false)
        .remove();
      rect = undefined;
    }

    var x = Math.min(Math.max(0, m.x), canvas.width);
    var y = Math.min(Math.max(0, m.y), canvas.height);
    rect = draw.rect(0, 0);
    rect.x(x).y(y);
    rect.addClass('select');
    rect.remember('start', {x: x, y: y});
    renderSelection();
  }

  function onMouseMove(e) {
    var m = getMousePosition(e);
    $mouse.html(m.x + ', ' + m.y);
    if (rect) {
      var start = rect.remember('start');
      if (start) {
        var x = Math.min(Math.max(0, Math.min(start.x, m.x)), canvas.width);
        var y = Math.min(Math.max(0, Math.min(start.y, m.y)), canvas.height);
        var width = Math.max(0, Math.max(start.x, m.x) - x);
        var height = Math.max(0, Math.max(start.y, m.y) - y);
        if (x+width > canvas.width) width = canvas.width - x;
        if (y+height > canvas.height) height = canvas.height - y;
        rect.x(x).y(y).width(width).height(height);
      }
    }
    renderSelection();
  }

  function onMouseUp(e) {
    var m = getMousePosition(e);
    if (rect && rect.remember('start')) {
      if (rect.width() == 0 && rect.height() == 0) {
        rect.remove();
        rect = undefined;
        renderSelection();
        return;
      }
      rect.forget('start')
        .selectize({rotationPoint: false, pointType: 'rect'})
        .resize({
          constraint: {minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height}
        })
        .draggable();
    }
  }

  $(document).on('mousemove', onMouseMove);
  $(document).on('mousedown', onMouseDown);
  $(document).on('mouseup', onMouseUp);

});