$(document).ready(function() {

  // ==========================================================================
  // 
  // Clip Paint - Paint in the Browser
  // 
  // IMPORTANT VARS
  // - $content: jQuery div element that contains all that we draw
  // - canvas, ctx: canvas DOM element we draw on
  // - img: intermediate DOM element to capture and process pasted images
  // - draw: svg.js object wrapping the SVG DOM element.
  // - hermite: Hermite object to resize images.
  //
  // CANVAS & SVG
  // The canvas and SVG elements serve different purposes. The canvas, just as
  // the name implies, is the drawing canvas. SVG is used to handle human
  // interactions. For instance drawing a select box, clipping an image,
  // dragging an image, dropping an image and canvas resize. We use the svg.js
  // library to provide that functionality.
  //
  // DEPENDENCIES
  // - Bootstrap 4
  // - jQuery 3 (slim version)
  // - FontAwesome 4
  // - svg.js and a few plugins
  // - hermite.js for image resize
  // - download.js to download image
  //
  // ==========================================================================
  var $content = $('.content');
  var canvas = $('canvas')[0];
  var ctx = canvas.getContext('2d');
  var img = $('img').hide()[0];
  var draw = SVG('drawing').size(0, 0);
  var hermite = new Hermite_class();



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

  $message.first().html(`
    Copy your screen by pressing on the Print Screen key.
    Then paste (Ctrl+v) as an image.
  `);
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
      showMessage("Image pasted. Cut, copy and paste some more.");
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
      showMessage('Image pasted. Cut, copy and paste some more.');
      setTimeout(function() {
        deferred.resolve();
      }, 25);
    };
    reader.readAsDataURL(file);
    return deferred;
  };

  function copyImageToSelection() {
    showMessage('Copying to canvas...');
    if (canvas.width < img.naturalWidth || canvas.height < img.naturalHeight)
      setCanvasSize(Math.max(canvas.width, img.naturalWidth), Math.max(canvas.height, img.naturalHeight));
    createSelection(0, 0, img.naturalWidth, img.naturalHeight, img.src);
    showMessage('Image pasted. Cut, copy and paste some more.');
  }

  function onPaste(e) {
    if (!e.originalEvent.clipboardData || !e.originalEvent.clipboardData.items) return;

    var items = e.originalEvent.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
      if (/^image\/(p?jpeg|gif|png)$/i.test(items[i].type)) {
        cancelSelection();
        loadImageFromFile(items[i].getAsFile()).done(copyImageToSelection);
        return;
      }
      if (items[i].type == 'text/plain') {
        items[i].getAsString(function(text) {
          if (text.indexOf('data:image/png;base64,') === 0) {
            loadImageFromDataUrl(text).done(copyImageToSelection);
            return;
          }
          showMessage('No image found on your Clipboard!', true);
        });
        return;
      }
      showMessage('No image found on your Clipboard!', true);
    }
  }




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

  function setCanvasSize(width, height, ignoreUndoRedo) {
    if (width != canvas.width || height != canvas.height) {
      if (!ignoreUndoRedo) {
        clearRedoStack();
        addCanvasResizeOperationToStack(width, height);
      }
      var imageData = ctx.getImageData(0, 0, Math.min(width, canvas.width), Math.min(height, canvas.height));
      canvas.width = width;
      canvas.height = height;
      ctx.putImageData(imageData, 0, 0);
    }
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
      crect.forget('allowResize')
        .resize('stop')
        .selectize(false);
    }
  }

  function initCanvas(width, height) {
    canvas.width = width;
    canvas.height = height;
    crect = draw.rect(canvas.width, canvas.height)
      .addClass('canvas')
      .on('resizing', function() {
        draw.size(crect.width()+5, crect.height()+5);
      })
      .on('resizedone', function() {
        setCanvasSize(crect.width(), crect.height());
      });
    setCanvasSize(width, height, true);
    allowCanvasResize(true);
  }
  if (window.localStorage.ClipPaintClone) {
    var clone = JSON.parse(window.localStorage.ClipPaintClone);
    delete window.localStorage.ClipPaintClone;
    initCanvas(clone.width, clone.height);
    loadImageFromDataUrl(clone.imageDataUrl).done(function() {
      ctx.drawImage(img, 0, 0);
    });
  } else {
    initCanvas(window.innerWidth-30, window.innerHeight-56-40-10);
  }


  // ==========================================================================
  //
  // SELECTION
  //
  // Selection is handled via mouse events (mousedown, mousemove, mouseup) on
  // SVG elements. We use event delegation via the document root element.
  //
  // SVG element srect is the selection box. When the user has finished
  // creating the selection box, it becomes resizable and draggable. The
  // overlapping image on canvas is clipped and copied onto SVG element simage.
  // When the selection is cancelled, the simage is dropped and copied back
  // on canvas at the new position.
  //
  // ==========================================================================
  var srect;
  var simage;

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

  function resizeSelection(width, height) {
    if (!simage || !srect) return;
    var newWidth = Math.round(srect.width());
    var newHeight = Math.round(srect.height());
    if (simage.width() == newWidth && simage.height() == newHeight) return;

    var tmpCanvas = document.createElement('canvas');
    var tmpCtx = tmpCanvas.getContext('2d');

    // Always resize against the original image
    var originalImageData = simage.remember('originalImageData');
    if (originalImageData) {
      tmpCanvas.width = originalImageData.width;
      tmpCanvas.height = originalImageData.height;
      tmpCtx.putImageData(originalImageData, 0, 0);
    } else {
      tmpCanvas.width = simage.width();
      tmpCanvas.height = simage.height();
      tmpCtx.drawImage(simage.node, 0, 0);
      originalImageData = tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
    }

    simage.remove();
    simage = undefined;

    hermite.resample_single(tmpCanvas, newWidth, newHeight, true);
    var dataUrl = tmpCanvas.toDataURL('image/png');

    simage = draw.image(dataUrl, newWidth, newHeight);
    simage.x(srect.x()).y(srect.y());
    simage.remember('originalImageData', originalImageData);
    srect.before(simage);

    tmpCanvas.remove();
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
      clearRedoStack();
      addClipOperationToStack(x, y, width, height);
      ctx.clearRect(x, y, width, height);
    }

    if (!srect.remember('selected')) {
      // Allow resize and dragging of selection rectangle
      srect.forget('start')
        .remember('selected', true)
        .selectize({
          rotationPoint: false,
          pointType: 'rect'
        })
        .resize({
          saveAspectRatio: true,
          constraint: {minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height}
        })
        .on('resizedone', function() {
          resizeSelection(srect.width(), srect.height());
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
    renderToolbar();
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
      if (!preventDrop) {
        clearRedoStack();
        addDropOperationToStack(simage.x(), simage.y(), simage.width(), simage.height());
        ctx.drawImage(simage.node, simage.x(), simage.y());
      }
      simage.remove();
      simage = undefined;
    }

    allowCanvasResize(true);
    renderSelectionSizeAndMousePosition();
    renderToolbar();
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

  $(document).on('mousemove', onMouseMove);
  $(document).on('mousedown', onMouseDown);
  $(document).on('mouseup', onMouseUp);




  // ==========================================================================
  //
  // UNDO AND REDO
  //
  // Track operations on a stack and allow the user to undo and redo.
  // Variables done and undone are arrays containing operations that were
  // done and undone, respectively.
  //
  // ==========================================================================
  var done = window.done = [];
  var undone = window.undone = [];

  function addClipOperationToStack(x, y, width, height, stack) {
    (stack || done).push({
      type: 'clip',
      imageData: ctx.getImageData(x, y, width, height),
      x: x,
      y: y,
      width: width,
      height: height
    });
  }

  function addDropOperationToStack(x, y, width, height, stack) {
    // Eliminate self-canceling operation of a drop on a clip at same position
    if (!stack && done.length > 0) {
      if (done.length > 0) {
        var op = done[done.length-1];
        if (op.type == 'clip' && op.x == x && op.y == y && op.width == width && op.height == height) {
          done.pop();
          return;
        }
      }
    }

    (stack || done).push({
      type: 'drop',
      imageData: ctx.getImageData(x, y, width, height),
      x: x,
      y: y,
      width: width,
      height: height
    });
  }

  function addCanvasResizeOperationToStack(width, height, stack) {
    (stack || done).push({
      type: 'canvas-resize',
      originalWidth: canvas.width,
      originalHeight: canvas.height,
      newWidth: width,
      newHeight: height,
      verticalImageData: width < canvas.width ? ctx.getImageData(width, 0, canvas.width - width, Math.min(canvas.height, height)) : undefined,
      horizontalImageData: height < canvas.height ? ctx.getImageData(0, height, Math.min(canvas.width, width), canvas.height - height) : undefined,
      cornerImageData: width < canvas.width && height < canvas.height ? ctx.getImageData(width, height, canvas.width - width, canvas.height - height) : undefined
    });
  }

  function undoClipOrDropOperation(op) {
    ctx.putImageData(op.imageData, op.x, op.y);
  }

  function undoCanvasResizeOperation(op) {
    setCanvasSize(op.originalWidth, op.originalHeight, true);
    if (op.verticalImageData)
      ctx.putImageData(op.verticalImageData, op.originalWidth, 0);
    if (op.horizontalImageData)
      ctx.putImageData(op.horizontalImageData, 0, op.originalHeight);
    if (op.cornerImageData)
      ctx.putImageData(op.cornerImageData, op.originalWidth, op.originalHeight);
  }

  function applyOperationOnTopOfStack(stack, otherStack) {
    if (stack.length == 0) return;
    var op = stack.pop();

    cancelSelection(true);
    switch (op.type) {
      case 'clip':
        addDropOperationToStack(op.x, op.y, op.width, op.height, otherStack);
        undoClipOrDropOperation(op);
        break;
      case 'drop':
        addClipOperationToStack(op.x, op.y, op.width, op.height, otherStack);
        undoClipOrDropOperation(op);
        break;
      case 'canvas-resize':
        addCanvasResizeOperationToStack(op.newWidth, op.newHeight, otherStack);
        undoCanvasResizeOperation(op);
        break;
    }
    renderToolbar();
  }

  function clearRedoStack() {
    undone = [];
  }

  function undo() {
    return applyOperationOnTopOfStack(done, undone);
  }

  function redo() {
    return applyOperationOnTopOfStack(undone, done);
  }




  // ==========================================================================
  //
  // KEYBOARD BINDINGS
  //
  // Handle keyboard shortcuts for various operations via the document's 
  // keydown event. The exception is the paste or Ctrl + v which is handled
  // directly via the document's paste event.
  //
  // ==========================================================================

  function onKeyDown(e) {
    switch (e.keyCode) {
      case 27: // Esc (drop selection in place)
        if (srect || simage) {
          e.preventDefault();
          cancelSelection();
        }
        break;
      case 46: // Delete
      case 8: // Backspace (delete selection)
        if (simage) {
          e.preventDefault();
          cancelSelection(true);
        }
        break;
      case 67: // Ctrl + c (copy)
        if (e.ctrlKey && simage) {
          e.preventDefault();
          copySelectionToClipboard();
        }
        break;
      case 65: // Ctrl + a (select all)
        if (e.ctrlKey) {
          e.preventDefault();
          cancelSelection();
          createSelection(0, 0, canvas.width, canvas.height);
        }
        break;
      case 88: // Ctrl + x (cut)
        if (e.ctrlKey && simage) {
          e.preventDefault();
          copySelectionToClipboard();
          cancelSelection(true);
        }
        break;
      case 90: // Ctrl + z (undo)
        if (e.ctrlKey) {
          e.preventDefault();
          undo();
        }
        break;
      case 89: // Ctrl + y (redo)
        if (e.ctrlKey) {
          e.preventDefault();
          redo();
        }
    }
  }
  
  $(document).on('keydown', onKeyDown);
  $(document).on('paste', onPaste);




  // ==========================================================================
  //
  // TOOLBAR
  //
  // ...
  //
  // ==========================================================================

  function renderToolbar() {
    if (simage) $('.action.cut,.action.copy').removeAttr('disabled');
    else $('.action.cut,.action.copy').attr('disabled', true);

    if (done.length) $('.action.undo').removeAttr('disabled')
    else $('.action.undo').attr('disabled', true);

    if (undone.length) $('.action.redo').removeAttr('disabled')
    else $('.action.redo').attr('disabled', true);
  }

  $('.action.select-all').click(function() {
    cancelSelection();
    createSelection(0, 0, canvas.width, canvas.height);
  });

  $('.action.cut').click(function() {
    copySelectionToClipboard();
    cancelSelection(true);
  });

  $('.action.copy').click(function() {
    copySelectionToClipboard();
    cancelSelection(true);
  });

  $('.action.paste').tooltip();

  $('.action.undo').click(undo);

  $('.action.redo').click(redo);

  $('.action.download').click(function() {
    var now = (new Date()).toISOString().substr(0, 16).replace('T', '_').replace(':','h');
    download(getDataUrlFromCanvas(0, 0, canvas.width, canvas.height), 'clippaint_' + now + '.png', 'image/png');
  });

  $('.action.clone').click(function(e) {
    var clone = JSON.stringify({
      width: canvas.width,
      height: canvas.height,
      imageDataUrl: getDataUrlFromCanvas(0, 0, canvas.width, canvas.height)
    });
    try {
      window.localStorage.ClipPaintClone = clone;
      window.open(window.location.href, '_blank').focus();
    } catch (err) {
      $('body').append(`
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
          Oh crap the image is too big to clone...
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      `);
    }
  });

  // Prevent form in navbar from submitting as its only used
  // as a container of buttons
  $('form').on('submit', function(e) {
    e.preventDefault();
    return false;
  });

  renderToolbar();

});